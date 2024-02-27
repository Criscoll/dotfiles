#!/bin/sh

rclone sync ~/Documents/Obsidian googledrive:Notes \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-during \
	--exclude 'node_modules/**' \
	--exclude '.git/**' \
	--verbose --progress \
	--metadata \
