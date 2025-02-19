#!/bin/sh

rclone sync googledrive:Notes ~/Documents/Obsidian \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-after \
	--exclude 'node_modules/**' \
    --exclude '.git/**' \
	--exclude 'venv/**' \
	--verbose --progress \
