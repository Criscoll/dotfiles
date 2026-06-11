#!/bin/sh

rclone sync googledrive:Notes ~/Repos/scribbles \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-after \
	--exclude 'node_modules/**' \
    --exclude '.git/**' \
	--exclude 'venv/**' \
	--verbose --progress \
