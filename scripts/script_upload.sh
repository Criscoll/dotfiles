#!/usr/bin/env zsh

rclone sync ~/Scripts googledrive:Environment\ Backups/Scripts \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-during \
	--verbose --progress \
