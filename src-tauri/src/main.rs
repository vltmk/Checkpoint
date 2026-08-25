// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Set explicit AppUserModelID so Windows taskbar pinning and grouping match the application
        let app_id: Vec<u16> = OsStr::new("com.checkpoint.app")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
        }
    }

    checkpoint_lib::run()
}

