#!/bin/fish
for md in documents/*.md
    set html (path change-extension '' $md).html
    if test $md -nt $html
        echo "Updating $md" && pandoc $md -o $html
    else
        echo "$md Already Up To Date"
    end
end
