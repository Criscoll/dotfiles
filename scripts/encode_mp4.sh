#!/usr/bin/env zsh

# Define a function to handle the interrupt signal
interrupt_handler() {
    echo "Interrupt signal received. Exiting..."
    exit 1
}

# Set the nocaseglob option to make the for loop case-insensitive
setopt nocaseglob

# Create a directory to store the transcoded files
mkdir -p transcoded

# Set up the trap to call the interrupt_handler function when the script receives an interrupt signal
trap interrupt_handler SIGINT SIGTERM

# Iterate over all .mp4 files in the current directory
for i in *.mp4; do
  # Check if the transcoded file already exists
  output_file="transcoded/${i%.*}.mov"
  if [ -f "$output_file" ]; then
    echo "Transcoded file for $i already exists, skipping..."
    continue
  fi

  # Use ffmpeg to transcode the file to the desired format and quality
  echo "Processing: $i"
  ffmpeg -i "$i" \
    -threads 1 \
    -vcodec mjpeg -q:v 2 \
    -acodec pcm_s16be -q:a 0 \
    -f mov "$output_file"
done

