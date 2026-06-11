#!/bin/sh

rclone sync ~/Repos/scribbles googledrive:Notes \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-during \
	--exclude 'node_modules/**' \
	--exclude '.git/**' \
	--exclude 'venv/**' \
	--verbose --progress \
	--metadata \
