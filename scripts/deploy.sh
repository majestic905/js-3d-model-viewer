npm run build
sed -i -e 's/viewer\.js/viewer\.min\.js/g' dist/index.html
firebase deploy --only hosting

rm dist/js/viewer.min.js
rm dist/js/viewer.min.js.map
sed -i -e 's/viewer\.min\.js/viewer\.js/g' dist/index.html