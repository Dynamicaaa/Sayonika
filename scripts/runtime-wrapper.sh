#!/bin/bash
# Auto-generated runtime wrapper for Sayonika
source "$(dirname "$0")/runtime-detect.sh"
detect_runtimes
preferred=$(get_preferred_runtime)
if [ -z "$preferred" ]; then
    echo "❌ No suitable runtime found" >&2
    exit 1
fi
cd "$(dirname "$0")/.."

# Check if runtime-specific script exists
script_name="$1"
runtime_script="${script_name}:${preferred}"

# Check if the runtime-specific script exists in package.json
if npm run | grep -q "^s*$runtime_scripts*$"; then
    case "$preferred" in
        "node") npm run "$runtime_script" "${@:2}" ;;
        "bun") bun run "$runtime_script" "${@:2}" ;;
        *) echo "❌ Unsupported runtime: $preferred" >&2; exit 1 ;;
    esac
else
    # Fallback to original script name if runtime-specific doesn't exist
    case "$preferred" in
        "node") npm run "$script_name" "${@:2}" ;;
        "bun") bun run "$script_name" "${@:2}" ;;
        *) echo "❌ Unsupported runtime: $preferred" >&2; exit 1 ;;
    esac
fi