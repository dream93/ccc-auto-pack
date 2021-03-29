"use strict";

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync, spawn } = require("child_process");
const crypto = require('crypto');

const yaml = require('yamljs');
const images = require('images');

let backData;
let configData;

// 初始化参数
function init(projectDir, toolsDir) {
    console.log(`工程目录=${projectDir}`, `工具目录=${toolsDir}`);
    const configPath = path.join(projectDir, 'settings', 'pack.config.yml');
    const backPath = path.join(projectDir, 'settings', 'pack.back.json');
    if (!fs.existsSync(configPath)) {
        console.error(`配置文件不存在`, configPath);
        return;
    }
    configData = fs.readFileSync(configPath).toString();
    configData = yaml.parse(configData);
    configData.projectDir = projectDir;
    configData.toolsDir = toolsDir;
    console.log('配置内容', configData);
    // 输出目录
    if (os.platform() === 'darwin') { // 苹果
        configData.outputDir = configData.macOutputDir;
    } else if (os.platform() === 'win32') { // windows
        configData.outputDir = configData.winOutputDir;
    } else {
        console.error('平台不支持');
        return;
    }
    mkdirSync(configData.outputDir);
    // 备份内容
    if (fs.existsSync(backPath)) {
        backData = fs.readFileSync(backPath);
        try {
            backData = JSON.parse(backData);
        } catch (e) { }
    }
    if (null == backData) {
        backData = {};
    }
    backData = Object.assign({ clientCode: 0, webCode: 0, appCode: 0 }, backData);
    console.log('备份内容', backData);

    // 开始构建
    startBuild();
}
module.exports.init = init;

function startBuild() {
    let enginePath;
    if (os.platform() === 'darwin') {
        enginePath = `/Applications/CocosCreator/Creator/${configData.engineVer}/CocosCreator.app/Contents/MacOS/CocosCreator`;
    } else if (os.platform() === 'win32') {
        enginePath = `D:/CocosDashboard/resources/.editors/Creator/${configData.engineVer}/CocosCreator.exe`
    }
    let outputDir = path.join(configData.outputDir, configData.title);
    if (configData.webCode > backData.webCode) {
        // 构建Cocos web版本
        console.log('构建web-mobile版本开始');
        const cmd = `${enginePath} --path ${configData.projectDir} --build "title=${configData.title};platform=web-mobile;buildPath=${outputDir};debug=false;inlineSpriteFrames=false;mergeStartScene=false;optimizeHotUpdate=false; webOrientation=${configData.orientation};md5Cache=true;"`;
        try {
            execSync(cmd);
            backData.webCode = configData.webCode;
            saveConfig();
            console.log('构建web-mobile版本成功');
        } catch (e) {
            console.log(`构建web-mobile版本错误：${e}`);
            return;
        }
    }

    // 多渠道打包等判断，可能代码没有修改，只是需要修改其它参数
    if (configData.clientCode > backData.clientCode) {
        // 构建Cocos 原生版本
        console.log('构建JSB版本开始');
        const appABIs = JSON.stringify(configData.appABIs).replace(/"/g, '\'');
        const cmd = `${enginePath} --path ${configData.projectDir} --build "title=${configData.title};platform=android;buildPath=${outputDir};debug=false;inlineSpriteFrames=false;mergeStartScene=false;optimizeHotUpdate=false;packageName=${configData.packageName};useDebugKeystore=true;orientation={'portrait':${configData.orientation == 'portrait'},'landscapeLeft':${configData.orientation != 'portrait'},'landscapeRight':${configData.orientation != 'portrait'}};template=link;apiLevel=${configData.apiLevel};appABIs=${appABIs};md5Cache=false;encryptJs=true;xxteaKey=${configData.xxteaKey};zipCompressJs=true;"`;
        try {
            execSync(cmd);
        } catch (e) {
            console.log(`构建JSB版本错误：${e}`);
            return;
        }

        // 制作热更包
        let bool = uploadHotUpdate();

        if (!bool) {
            return;
        }

        backData.clientCode = configData.clientCode;
        saveConfig();
        console.log('构建JSB版本成功');

    }


    // 安卓打包
    if (configData.appCode > backData.appCode) {
        let bool = packAPK();
        if (!bool) {
            return;
        }
        backData.appCode = configData.appCode;
        saveConfig();
        console.log('安卓构建成功');
    }
}

function packAPK() {
    // 重要配置
    let storeFile;
    let password;
    let alias;
    let keyPassword;
    if (os.platform() === 'darwin') {
        storeFile = '';
        password = '';
        alias = '';
        keyPassword = '';
    } else if (os.platform === 'win32') {
        storeFile = '';
        password = '';
        alias = '';
        keyPassword = '';
    }

    const androidDir = path.join(configData.outputDir, configData.title, 'jsb-link', 'frameworks', 'runtime-src', 'proj.android-studio');
    // 可以复制一些资源，比如SDK文件，资源文件等
    // ...
    // 制作icon
    const icons = [
        { url: 'mipmap-ldpi', width: 36, height: 36 },
        { url: 'mipmap-mdpi', width: 48, height: 48 },
        { url: 'mipmap-hdpi', width: 72, height: 72 },
        { url: 'mipmap-xhdpi', width: 96, height: 96 },
        { url: 'mipmap-xxhdpi', width: 144, height: 144 },
        { url: 'mipmap-xxxhdpi', width: 192, height: 192 }
    ];
    const width = [];
    for (let i = 0; i < icons.length; i++) {
        const iconPath = path.join(androidDir, 'res', icons[i].url);
        mkdirSync(iconPath);
        images(path.join(configData.projectDir, 'settings', 'logo.png'))
            .size(icons[i].width)
            .save(path.join(iconPath, 'ic_launcher.png'));
    }

    // 修改settings.gradle 删除':game'和':instantapp' 项目，不删除，则下面的打包语句需要对应修改成需要打包的项目
    const sgPath = path.join(androidDir, 'settings.gradle');
    let sgData = fs.readFileSync(sgPath).toString().replace(/\'\:instantapp\'/, "").replace(/\'\:game\'/, "").replace(/\,/, "").replace(/\,/, "");
    fs.writeFileSync(sgPath, sgData);



    // 升级gradle的修改
    const gwProp = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-5.6.4-all.zip`;
    fs.writeFileSync(path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties'), gwProp);
    // 修改mk
    const mkPath = path.join(androidDir, 'jni', 'CocosAndroid.mk');
    let mkText = fs.readFileSync(mkPath).toString().replace('cocos2djs_shared', 'cocos2djs');
    fs.writeFileSync(mkPath, mkText);
    // gralde.properties的修改
    const gp = `
PROP_COMPILE_SDK_VERSION=${configData.apiLevel}
PROP_MIN_SDK_VERSION=16
PROP_TARGET_SDK_VERSION=${configData.apiLevel}
PROP_BUILD_TOOLS_VERSION=28.0.3
PROP_APP_ABI=${JSON.stringify(configData.appABIs).replace('[', '').replace(']', '').replace(/\"/, '').replace(/\,/, ":")};
RELEASE_STORE_FILE=${storeFile}
RELEASE_STORE_PASSWORD=${password}
RELEASE_KEY_ALIAS=${alias}
RELEASE_KEY_PASSWORD=${keyPassword}

android.injected.testOnly=false
    `;
    fs.writeFileSync(path.join(androidDir, 'gradle.properties'), gp);

    const appPath = path.join(androidDir, 'app', 'build.gradle');
    let gradleData = fs.readFileSync(appPath).toString();
    let matcher = /\"\$\{outputDir\}\/[a-zA-Z-]+\"/g;
    let matchs = gradleData.match(matcher);
    if (null != matchs) {
        for (let i = 0; i < matchs.length; i++) {
            let newStr = `outputDir.dir("${matchs[i].substring(matchs[i].indexOf('/') + 1, matchs[i].length - 1)}")`;
            gradleData = gradleData.replace(/\"\$\{outputDir\}\/[a-zA-Z-]+\"/, newStr);
        }
    }
    let matcher1 = /applicationId[ ]+\"[a-zA-Z0-9_.]+\"/;
    gradleData = gradleData.replace(matcher1, `applicationId "${configData.packageName}"`);
    let matcher2 = /versionCode[ ]+[0-9]+/;
    gradleData = gradleData.replace(matcher2, `versionCode ${configData.appCode}`);
    let matcher3 = /versionName[ ]+\"[0-9.]+\"/;
    gradleData = gradleData.replace(matcher3, `versionName "${configData.appVer}"`);

    fs.writeFileSync(appPath, gradleData);

    console.log('开始构建APK');
    try {
        if (os.platform() === 'darwin') {
            execFileSync('./gradlew', [':' + configData.title + ':assembleRelease'], { cwd: androidDir });
            // 实时结果查看
            // const gradlewSpawn = spawn('./gradlew', [':' + configData.title + ':assembleRelease'], { cwd: androidDir });
            // gradlewSpawn.stdout.on('data', function (chunk) {
            //     console.log(chunk.toString());
            // });
            // gradlewSpawn.stderr.on('data', (data) => {
            //     console.log(data);
            // });
            // gradlewSpawn.on('close', function (code) {
            //     console.log('close code : ' + code);
            // })
            // gradlewSpawn.on('exit', (code) => {
            //     console.log('exit code : ' + code);
            // });
        } else if (os.platform === 'win32') {
            execFileSync('gradlew.bat', [':' + configData.title + ':assembleRelease'], { cwd: androidDir });
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }


}

let a = `applicationId "org.cocos2d.demo"`;
console.log(a.replace(/applicationId[ ]+\"[a-zA-Z0-9_.]+\"/, 'here'));

function uploadHotUpdate() {
    console.log('开始备份未混淆的代码');
    const ver = configData.clientVer + "." + configData.clientCode;
    const buildDir = path.join(configData.outputDir, configData.title, 'jsb-link');
    const dstDir = path.join(buildDir, 'js backups (useful for debugging)');
    const backupsDir = path.join(configData.outputDir, configData.title, 'js backups', ver);
    copyFileSync(dstDir, backupsDir);
    console.log('开始制作热更包');
    const hotUpdateDir = path.join(configData.outputDir, configData.title, 'hotupdate', ver);
    // src目录
    copyFileSync(path.join(buildDir, 'src'), path.join(hotUpdateDir, 'src'));
    // 2.4.0及以上引擎
    if (compareVersion(configData.engineVer, '2.4.0')) {
        // 移动assets
        copyFileSync(path.join(buildDir, 'assets'), path.join(hotUpdateDir, 'assets'));
    } else {
        // 移动res和subpackages
        copyFileSync(path.join(buildDir, 'res'), path.join(hotUpdateDir, 'res'));
        copyFileSync(path.join(buildDir, 'subpackages'), path.join(hotUpdateDir, 'subpackages'));
    }
    console.log('开始制作manifest文件');
    if (configData.hotUpdateUrl.indexOf('/') != configData.hotUpdateUrl.length - 1) {
        configData.hotUpdateUrl += '/';
    }
    const packageUrl = `${configData.hotUpdateUrl}${configData.title}/${ver}/`;
    let manifest = {
        packageUrl: packageUrl,
        remoteManifestUrl: `${packageUrl} project.manifest`,
        remoteVersionUrl: `${packageUrl} version.manifest`,
        version: `${ver} `,
        assets: {}
    }
    let files = getAllFiles(hotUpdateDir);
    let manifestPath = null;
    files.forEach((filePath) => {
        const relative = encodeURI(path.relative(hotUpdateDir, filePath).replace(/\\/g, '/'));
        console.log(filePath);
        if (path.extname(filePath) === '.manifest') { // manifest 不进行更新
            manifestPath = relative;
        } else {
            let md5 = crypto.createHash('md5').update(fs.readFileSync(filePath, 'binary')).digest('hex');

            manifest.assets[relative] = {
                size: fs.statSync(filePath),
                md5: md5
            }
            let compressed = path.extname(filePath).toLowerCase() === '.zip';
            if (compressed) { // 默认值为false，为节省空间，只有为true的时候才复制
                manifest.assets[relative].compressed = compressed;
            }
        }
    });
    fs.writeFileSync(path.join(hotUpdateDir, 'project.manifest'), JSON.stringify(manifest, null, 0)); // manifest较大，不要格式化
    if (null == manifestPath) {
        console.warn('文件中没有manifest文件，将无法热更！');
    } else {
        fs.writeFileSync(path.join(buildDir, manifestPath), JSON.stringify(manifest, null, 0));
    }
    // 制作version.manifest 删除assets信息
    delete manifest.assets;
    fs.writeFileSync(path.join(hotUpdateDir, 'version.manifest'), JSON.stringify(manifest, null, 4)); // 文件较小，直接展示信息
    // 上传到空间
    // TODO 此处命令是腾讯COS 根据自行需要替换
    const cmd = `coscmd upload - r ${hotUpdateDir} /hotUpdate/${configData.title} /${ver}`;
    try {
        // execSync(cmd);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}


function saveConfig() {
    const backPath = path.join(configData.projectDir, 'settings', 'pack.back.json');
    fs.writeFileSync(backPath, JSON.stringify(backData));
    console.log('写入备份成功');
}

function compareVersion(ver1, ver2) {
    var arr1 = ver1.split('.');
    var arr2 = ver2.split('.');
    var length = Math.min(arr1.length, arr2.length);
    for (var i = 0; i < length; i++) {
        if (arr1[i] == arr2[i]) {
            continue;
        }
        return arr1[i] > arr2[i];
    }
    return arr1.length >= arr2.length;
}

function mkdirSync(dirPath, mode) {
    if (fs.existsSync(dirPath)) {
        return true;
    }
    if (mkdirSync(path.dirname(dirPath), mode)) {
        fs.mkdirSync(dirPath, mode);
        return true;
    }
}

function copyFileSync(src, dst) {
    if (!fs.existsSync(src)) {
        console.error('原路径不存在', src);
        return;
    }
    const stat = fs.statSync(src);
    if (stat.isFile()) {
        let dstDir = path.parse(dst).dir;
        if (!fs.existsSync(dstDir)) {
            mkdirSync(dstDir);
        }
        fs.copyFileSync(src, dst);
    } else if (stat.isDirectory()) {
        const files = fs.readdirSync(src);
        files.forEach((file) => {
            console.log(src, file, dst);
            const srcPath = path.join(src, file);
            const dstPath = path.join(dst, file);
            copyFileSync(srcPath, dstPath);
        });
    }
}

function getAllFiles(dir) {
    const stat = fs.statSync(dir);
    if (stat.isFile()) {
        return [dir];
    }
    let all = [];
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filePath = path.join(dir, file);
        let files = getAllFiles(filePath);
        all = all.concat(files);
    });
    return all;
}