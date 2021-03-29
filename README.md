# ccc-pack
基于CocosCreator的自动化打包

# 使用

1. 在项目的settings文件夹下，创建一个配置文件**pack.config.yml**

2. 如果需要构建原生平台，需将icon移到settings下，名称为**logo.png**

3. 运行app.js【命令行形式、服务器形式、借助jenkins等实现自动化】 传入项目路径即可。

- 配置参考

```
# 显示版本
clientVer: 1.0.0
# 打包判断版本
clientCode: 1

# 项目名称，构建后的目录名
title: PackTest
# 应用名称
appName: 自动化打包测试
# 屏幕方向
orientation: portrait

# 引擎版本
engineVer: 2.4.3

# 输出目录
winOutputDir: 'F:'
macOutputDir: '/Users/zhise'

# 平台相关，可根据自己需求修改

# web构建等
# 网页显示版本
webVer: 1.0.0
# 网页判断版本
webCode: 1
# 如果集成了H5适配优化插件
designWidth: 750
designHeight: 1334

# 原生构建
# app显示版本
appVer: 1.0.0
# app判断版本
appCode: 1
# 热更地址
hotUpdateUrl: https://www.baidu.com/
# 构建渠道
channel: 测试
# 包名
packageName: com.xyzzlky.test.pack
# sdk版本
apiLevel: 28
# 支持的架构
appABIs:
    - armeabi-v7a
# 脚本加密
xxteaKey: 318927a2-2183-4c

# SDK接入相关
buglyAppId: 1
buglyAppKey: test
```


