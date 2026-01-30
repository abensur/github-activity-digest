📊 WEEKLY SUMMARY
2026-01-23 to 2026-01-30

Major dive computer support improvements, kernel networking and memory fixes, audio processing enhancements, and editor usability improvements were delivered across five active repositories.

📦 subsurface/libdc
[3 files changed, +63/-38 lines]
Enhanced Heinrichs Weikamp OSTC4 and OSTC5 dive computer support by implementing proper model detection and display in the Extra Info section. The changes separate OSTC 4 and OSTC 5 models for better device identification.

📦 subsurface/subsurface
[20 files changed, +143/-85 lines]
Fixed version generation in documentation and build system. Improved Heinrichs Weikamp OSTC 4/5 dive computer model recognition during data import and updated the supported device list. Enhanced user interface by adding seconds notation to duration labels on dive notes tab for better clarity.

📦 torvalds/AudioNoise
[5 files changed, +9/-8 lines]
Fixed mathematical function usage in growlingbass module by replacing incorrect abs() with fabsf() for floating point operations. Added compiler warnings for implicit floating point to integer conversions to prevent future type-related issues.

📦 torvalds/linux
[172 files changed, +1333/-653 lines]
Integrated multiple subsystem fixes including power management, MTD, memory management, networking, and Btrfs improvements. Fixed critical networking issues in GRO fragmentation, MPTCP duplicate events, MLX5 driver problems, and NFC race conditions. Enhanced memory management with zone device reinitialization and KFENCE randomization improvements.

📦 torvalds/uemacs
[6 files changed, +20/-21 lines]
Improved editor usability by fixing page-up behavior at document top, eliminating unnecessary redraws, and removing problematic type-ahead logic. Fixed auto-repeat delays with control characters for smoother typing experience.

Automatically generated from 5 active repositories.