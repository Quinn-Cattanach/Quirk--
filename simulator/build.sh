#!/bin/bash
set -e

cargo test
wasm-pack build
cp -r ./bindings ../ui/src/simulator/
cp -r ./pkg ../ui/src/simulator/