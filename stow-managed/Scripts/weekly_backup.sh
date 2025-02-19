#!/bin/bash

rclone sync googledrive:Notes googledrive:Notes\ Backup/Weekly \
	--verbose --progress \
