# talk

![](https://upimage.alexhchu.com/2020/05/09/a3d10c630a08f.gif)

## tips

 1. 代码基于腾讯cloudbase；
 2. 函数、静态文件均包含在内，请根据微信公众号开发教程和cloudbase开发文档进行配置。

云函数模块依赖：

1. `tcb-admin-node` 腾讯云提供的云环境管理模块，数据插入需要用到；
2. `js-sha1` 请求来源验证中，签名的生成需要进行sha1加密；
3. `xmlreader` 由于微信服务器请求携带的数据为xml格式，需要对其进行转换成json对象。

项目包中已经含有模块，如果提示错误，请用户自行安装。（勿全局安装）

### 二次开发提示

虽然项目只用于单用户，但其实扩展成多用户亦无需太多改动。NoSQL添加一个集合用于保存微信用户的`open_id`，内容集合也添加`open_id`用于表示不同用户发布的内容，云函数插入数据时添加`open_id`，而前端无需多说，提取内容时加上where判断即可。

### 新增 by eallion
- 新增发布来源显示，目前只显示微信公众号
- 整合至 Hugo hello-frend theme [bb.html](https://github.com/eallion/eallion.com/blob/main/themes/hello-friend/layouts/_default/bb.html) 
    - Live Demo：[大大的小蜗牛-嘀咕](https://eallion.com/talk)
- 原作者完整云函数教程 [4f33627a9407424a2de2341169cdeecb4dcf8eb3](https://github.com/eallion/talk/blob/4f33627a9407424a2de2341169cdeecb4dcf8eb3/README.md)
