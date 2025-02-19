#!bin/sh

rclone bisync ~/Documents/Obsidian googledrive:Notes \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-after \
	--verbose --progress \
	--log-file ~/Crons/logs/obsidian_sync_log_$(date +%Y%m%d-%H:%M).txt
