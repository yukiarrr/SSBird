#!/bin/bash

script_dir=$(dirname "${0}")
cd "${script_dir}"

install() {
  if [ -e "${1}" ]; then
    host_file='SSBird'
    manifest_file='com.yukiarrr.ssbird.json'
    cp -r "./host/${host_file}" "${1}/${host_file}"
    sed -e "s#HOST_PATH#${1}/${host_file}#g" "./host/${manifest_file}" > "${1}/${manifest_file}"
  fi
}

install "${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
install "${HOME}/Library/Application Support/Chromium/NativeMessagingHosts"

echo 'Success!'
