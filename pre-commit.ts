import * as fs from "fs";

const hooks = `
#!/bin/sh
echo -e "\nValidating Javascript:\n"
# Check for eslint
which tsc &> /dev/null
if [[ "$?" == 1 ]]; then
  echo -e "\t\x1b[41mPlease install tsc\x1b[0m"
  exit 1
fi

tsc --noEmit

if [[ "$?" == 0 ]]; then
  echo -e "\x1b[42mCOMMIT SUCCEEDED\x1b[0m\n"
  exit 0
else
  echo -e "\x1b[41mCOMMIT FAILED:\x1b[0m Your commit contains files that should pass ESLint but do not. Please fix the ESLint errors and try again.\n"
  exit 1
fi
`;
fs.writeFileSync(".git/hooks/pre-commit", hooks.replace(/^[\n\r]+/, ""));
fs.chmodSync(".git/hooks/pre-commit", 0o755);
