use std::env;
use std::process::{Command, exit};
use std::time::{SystemTime, Duration};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashSet;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        exit(0);
    }

    let t0 = SystemTime::now();

    // Spawn compiler
    let compiler_path = &args[1];
    let compiler_args = &args[2..];

    let mut child = Command::new(compiler_path)
        .args(compiler_args)
        .spawn()
        .expect("Failed to execute compiler");

    let status = child.wait().expect("Failed to wait on compiler");
    if !status.success() {
        exit(status.code().unwrap_or(1));
    }

    // Compile succeeded! Let's sign any recently modified target executables.
    
    // Parse output file from -o if present
    let mut output_files = Vec::new();
    let mut i = 0;
    while i < compiler_args.len() {
        if compiler_args[i] == "-o" && i + 1 < compiler_args.len() {
            let out_file = &compiler_args[i + 1];
            if out_file.ends_with(".exe") || out_file.ends_with(".dll") {
                output_files.push(PathBuf::from(out_file));
            }
            i += 2;
        } else {
            i += 1;
        }
    }

    // Find target directories to walk
    let mut target_paths = Vec::new();
    if let Ok(curr) = env::current_dir() {
        let mut p = curr.as_path();
        loop {
            let t = p.join("target");
            if t.is_dir() {
                target_paths.push(t);
            }
            let st = p.join("src-tauri").join("target");
            if st.is_dir() {
                target_paths.push(st);
            }
            if let Some(parent) = p.parent() {
                p = parent;
            } else {
                break;
            }
        }
    }

    let mut files_to_sign = HashSet::new();
    for out_file in output_files {
        if out_file.is_file() {
            if let Ok(abs) = fs::canonicalize(&out_file) {
                files_to_sign.insert(abs);
            }
        }
    }

    // Walk target directories
    for t_dir in target_paths {
        walk_dir(&t_dir, &t0, &mut files_to_sign);
    }

    let signtool = r"C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe";
    let cert_thumbprint = "95D8E429E87EA79F4B22FB4231EDABAE40737D6A";

    for fpath in files_to_sign {
        let path_str = fpath.to_string_lossy();
        println!("[rustc-wrapper] Signing: {}", path_str);
        
        let sign_status = Command::new(signtool)
            .args(&[
                "sign",
                "/fd", "sha256",
                "/sha1", cert_thumbprint,
                &path_str,
            ])
            .status();

        match sign_status {
            Ok(s) if s.success() => {
                println!("[rustc-wrapper] Successfully signed: {}", path_str);
            }
            Ok(s) => {
                println!("[rustc-wrapper] Failed to sign (exit code {}): {}", s.code().unwrap_or(-1), path_str);
            }
            Err(e) => {
                println!("[rustc-wrapper] Error executing signtool for {}: {}", path_str, e);
            }
        }
    }
}

fn walk_dir(dir: &Path, t0: &SystemTime, files_to_sign: &mut HashSet<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                walk_dir(&path, t0, files_to_sign);
            } else if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "exe" || ext == "dll" {
                        if let Ok(metadata) = entry.metadata() {
                            if let Ok(mtime) = metadata.modified() {
                                let is_recent = match mtime.duration_since(*t0) {
                                    Ok(_) => true,
                                    Err(e) => e.duration() <= Duration::from_secs(2),
                                };
                                if is_recent {
                                    if let Ok(abs) = fs::canonicalize(&path) {
                                        files_to_sign.insert(abs);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
