npm run build
sed -i -e 's/viewer\.js/viewer\.min\.js/g' dist/index.html
firebase deploy --only hosting

git restore dist/js/viewer.min.js
git restore dist/js/viewer.min.js.map
sed -i -e 's/viewer\.min\.js/viewer\.js/g' dist/index.html