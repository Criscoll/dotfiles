#!/usr/bin/env zsh

rclone sync googledrive:Environment\ Backups/Scripts ~/Scripts  \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-during \
	--verbose --progress \
