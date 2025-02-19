#!bin/sh

rclone sync googledrive:Environment\ Backups/Thunderbird ~/snap/thunderbird/common/.thunderbird \
	--update --use-server-modtime \
	--ignore-checksum \
	--delete-after \
	--verbose --progress \
