#!/bin/sh

rclone sync ~/snap/thunderbird/common/.thunderbird googledrive:Environment\ Backups/Thunderbird \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-during \
	--verbose --progress \
