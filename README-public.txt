Everything in this folder is copied verbatim into dist/ on every build.

.nojekyll matters for GitHub Pages: without it, Pages runs the output through
Jekyll, which ignores any file or folder whose name starts with an underscore.
Vite does not emit those today, but it wipes dist/ on every build — so the file
has to live here rather than being added to dist/ by hand, which is how it went
missing before.
