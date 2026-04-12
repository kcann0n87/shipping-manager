#!/bin/bash
export PATH=$HOME/local/node/bin:$PATH
cd /Users/kylec/Downloads/shipping-label-manager
node server/index.js &
npx vite --host 0.0.0.0
