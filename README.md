# app for lego walker with babylon and electron

To run the app, use
```
npm ci
npm run configure
npm start
```

To build and install deb package, use
```
npm ci
npm run make
sudo dpkg -i out/make/deb/x64/*.deb
sudo setcap cap_net_raw+eip /usr/lib/babyele/babyele

```
