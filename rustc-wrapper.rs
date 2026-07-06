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
    
    // Parse output file or directory from arguments
    let mut output_dirs = Vec::new();
    let mut output_files = Vec::new();
    let mut i = 0;
    while i < compiler_args.len() {
        if compiler_args[i] == "-o" && i + 1 < compiler_args.len() {
            output_files.push(PathBuf::from(&compiler_args[i + 1]));
            i += 2;
        } else if compiler_args[i] == "--out-dir" && i + 1 < compiler_args.len() {
            output_dirs.push(PathBuf::from(&compiler_args[i + 1]));
            i += 2;
        } else {
            i += 1;
        }
    }

    let mut files_to_sign = HashSet::new();

    // 1. Process output_files (handling cases with/without .exe extension)
    for out_file in output_files {
        if out_file.is_file() {
            if let Ok(abs) = fs::canonicalize(&out_file) {
                files_to_sign.insert(abs);
            }
        }
        let exe_file = out_file.with_extension("exe");
        if exe_file.is_file() {
            if let Ok(abs) = fs::canonicalize(&exe_file) {
                files_to_sign.insert(abs);
            }
        }
    }

    // 2. Process output_dirs (walk the output directory directly)
    for out_dir in output_dirs {
        if out_dir.is_dir() {
            walk_dir(&out_dir, &t0, &mut files_to_sign);
        }
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
