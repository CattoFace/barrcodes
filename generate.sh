#!/bin/bash
for md in documents/*.md; do
  base=$(basename $md)
  html=${base::-3}.html
  full=site/$html
  fragment=site/fragment/$html
  if [ $md -nt $full ] || [ $md -nt $fragment ]; then
    echo "Updating $base"
    pandoc $md -o $full --template full_template.html
    pandoc $md -o $fragment --template fragment_template.html
    git add $full $fragment
  else
    echo "$base Already Up To Date"
  fi
done
