/**
 * 多用户发布到cloud的公众号服务端程序
 * date: 2021.01.05
 */

'use strict'

//引入模块
const tcb = require('@cloudbase/node-sdk') // 云开发 SDK
const sha1 = require('js-sha1')
const xmlreader = require('xmlreader')
const request = require('request')
const path = require('path');
const fs = require('fs')

//公众号服务器配置token值
const token = 'Your Token Here' // 微信服务器验证用的 令牌 token

//微信公众号appid和appsecret
var wxappid = '',
    wxappsecret = '',
    wxtoken = '',
    contentUrl,
    imgtype,
    houzhui = 'jpg',
    picUrl,
    userFile,
    contentUrl,
    test_media_id = ''

//云开发初始化
const app = tcb.init({env: 'env-ID'}) // 云开发环境 ID

//数据库初始化
const db = app.database()
const collection = db.collection('users') // 记录绑定的用户的信息的云开发数据库名称

var response

exports.main = async (event, context) => {
    /**
     * 鉴权，判断请求是否来自微信官方服务器
     */
    var signature = event.queryStringParameters.signature
    var timestamp = event.queryStringParameters.timestamp
    var nonce = event.queryStringParameters.nonce
    var tmpArr = [token,timestamp,nonce]
    var tmpStr = sha1(tmpArr.sort().join(''))

    if(tmpStr == signature){
        //请求来源鉴权成功
        //return event.queryStringParameters.echostr //服务器验证成功后删除本行代码
        
        var requestData = event.body //请求携带的xml消息数据

        //如果数据被base64加密过，则解码
        if(event.isBase64Encoded) requestData = (new Buffer(requestData, 'base64')).toString()

        //xml字符串转json对象
        xmlreader.read(requestData, function(err,res){requestData = res})

        var fromUserName = requestData.xml.FromUserName.text(),
            toUserName = requestData.xml.ToUserName.text(),
            createTime = Date.now(),
            msgType = requestData.xml.MsgType.text(),
            content = '',
            mediaId = ''
        if (msgType == 'text') {
            content = requestData.xml.Content.text()
        } else if (msgType == 'image') {
            content = requestData.xml.PicUrl.text()
            mediaId = requestData.xml.MediaId.text()
        }
        //获取用户信息
        const user = await collection.where({open_id:fromUserName}).get()

        if(user.data.length <= 0){
            // 用户不存在
            if(/^\/newuser[\: ]((?!,).)*,((?!,).)*$/.test(content)){
                var cloudInfo = (content.slice(9,content.length)).split(','),
                    Key = cloudInfo[0],
                    HttpUrl = cloudInfo[1]
                var bindRes = await collection.add({open_id: fromUserName,cloud_key: Key,cloud_httpurl: HttpUrl})
                if(bindRes.hasOwnProperty('id')){
                    content = '绑定成功，回复 /help 获取更多秘籍'
                }else{
                    content = '绑定失败'
                }
            }else{
                content = '已使用腾讯 cloudbase 部署参考 https://immmmm.com/bb-tx-cloudbase/ ，回复以下命令绑定用户/newuser KEY,HTTP访问地址。（其中 KEY 和 HTTP访问地址 为 talks-api 云函数设定的值。）'
            }
        }else if(user.data[0].open_id == fromUserName){
            userFile = user.data[0].open_id
            if ((msgType != 'text') && (msgType != 'image')) {
                content = '消息类型不允许'
            } else{
                switch(content){
                    case '/help':
                        content = '/del - 撤销最新一条嘀咕\n/unbind - 解除绑定'
                        break
                    case '/unbind':
                        var unbindRes = await collection.where({open_id: fromUserName}).remove()
                        if(unbindRes.hasOwnProperty('code')){
                            content = '解绑失败！'
                        }else{
                            content = '解绑成功！（回复 /newuser KEY,HTTPUrl 重新绑定。）'
                        }
                        break
                    default :
                        var cloudHttpUrl = user.data[0].cloud_httpurl,
                            cloudKey = user.data[0].cloud_key
                        
                        if (content.slice(0,1) == '/') {
                            if (content == '/del'){
                                await cloudRequest(cloudHttpUrl,cloudKey,content).then(function(res){requestRes = res},function(res){requestRes = res})
                                if(requestRes == 200){
                                    content = '撤消完成！'
                                }else{
                                    content = '撤消失败！'
                                }
                            }else{
                                content = '无此命令，回复 /help 查看更多'
                            }
                        }else{
                            await cloudRequest(cloudHttpUrl,cloudKey,content).then(function(res){requestRes = res},function(res){requestRes = res})
                            if(requestRes == 200){
                                if (msgType == 'text') {
                                    content = '嘀咕成功！（回复 /help 查看命令）'
                                }else if (msgType == 'image') {
                                    content = '发图成功！（回复 /help 查看命令）'
                                }
                            }else{
                                content = '嘀咕失败'+requestRes
                            }
                        }     
                }
            }
        }else{
            content = '用户验证失败'
        }

        //构造响应消息字符串
        response = '<xml>\
                        <ToUserName>'+fromUserName+'</ToUserName>\
                        <FromUserName>'+toUserName+'</FromUserName>\
                        <CreateTime>'+createTime+'</CreateTime>\
                        <MsgType><![CDATA[text]]></MsgType>\
                        <Content>'+content+'</Content>\
                    </xml>'
        
        return response

    }else{
        //请求来源鉴权失败
        return {error: 'request_denined'}
    }

}

//使用promise封装request解决异步请求致无法获取结果的问题
var requestRes
function cloudRequest(cloudHttpUrl,cloudKey,content){
    return new Promise(function(resoved,rejevted){
        var param1 = {'key': cloudKey,'text': content,'from':'微信'}
        request({
            url: cloudHttpUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            qs: param1
        },function(error, res, body) {
            if(error){
                rejevted(error)
            }else{
                resoved(res.statusCode)
            }
        })
    })
}

//下载微信临时素材图片
function downloadPic(test_picUrl, test_media_id) {
    return new Promise((r,e)=>{
    try {
        //改为下载至tmp临时空间
        const ws = fs.createWriteStream('/tmp/'+test_media_id+'.jpg', { autoClose: true })
        request(test_picUrl).pipe(ws);
        ws.on('finish', function () {
            console.log('ok')
            r('下载临时素材成功！')
        });

    } catch (err) {
        console.log(err)
        e('下载临时素材失败！')
    }
});
}

function uploadPhotoTo7Bu (test_media_id) {
      return new Promise((resolve) => {
        try {
          userFile = fs.readFileSync('/tmp/'+test_media_id+'.jpg')
          console.log(userFile)
          var formData = {'image' : userFile}
          request({
            url: 'https://7bu.top/api/upload',
            method: 'POST',
            headers: {
                'Content-Type': 'image/png'
            },
            formData: formData
          },function(error, res, body) {
            if(error){
                rejevted(error)
            }else{
                resoved(res.data.url)
                deleteFolderRecursive(/tmp/)
            }
          })
        } catch (e) {
          console.error(e)
        }
      })
}

//删除临时文件
function deleteFolderRecursive (url) {
    var files = [];
    //判断给定的路径是否存在
    if( fs.existsSync(url) ) {
        
        //返回文件和子目录的数组
        files = fs.readdirSync(url);
         
        files.forEach(function(file,index){
           // var curPath = url + "/" + file;
            var curPath = path.join(url,file);
            //fs.statSync同步读取文件夹文件，如果是文件夹，在重复触发函数
            if(fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
                 
            // 是文件delete file  
            } else {
                fs.unlinkSync(curPath);
            }
        });
        //清除文件夹
        console.log(url+'删除成功');
    }else{
        console.log("给定的路径不存在，请给出正确的路径");
    }
};