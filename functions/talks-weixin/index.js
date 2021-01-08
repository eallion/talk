/**
 * 多用户发布到cloud的公众号服务端程序
 * date: 2021.01.08
**/

'use strict'

//引入模块
const tcb = require('@cloudbase/node-sdk') // 云开发 SDK
const sha1 = require('js-sha1')
const xmlreader = require('xmlreader')
const request = require('request')
const path = require('path');
const fs = require('fs');

//公众号服务器配置token值
const token = 'xxxxx' // 微信服务器验证用的 令牌 token

//微信公众号appid和appsecret
var wxappid = 'x',
    wxappsecret = 'x',
    wxtoken = '',
    contentUrl,
    imgtype,
    houzhui = 'jpg',
    picUrl,
    userFile,
    test_media_id = '',
    buUrl = ''

//云开发初始化
const app = tcb.init({env: 'bb-f5c0f'})

//数据库初始化
const db = app.database()
const collection = db.collection('users')

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
                    content = '绑定成功，直接发「文字」或「图片」试试吧！回复 /h 获取更多秘籍'
                }else{
                    content = '绑定失败'
                }
            }else{
                content = '已使用腾讯 cloudbase 部署参考 https://immmmm.com/bb-tx-cloudbase/ ，回复以下命令绑定用户/newuser KEY,HTTP访问地址'
            }
        }else if(user.data[0].open_id == fromUserName){
            if ((msgType != 'text') && (msgType != 'image')) {
                content = '消息类型不允许'
            } else{
                switch(content){
                    case '/h':
                        content = '/l - 查询最新9条\n/d数字 - 删除第几条，如 /d2\n/u - 撤销最新一条嘀咕\n/u 数字 - 撤销最新几条嘀咕，如 /u 2\n/unbind - 解除绑定'
                        break
                    case '/unbind':
                        var unbindRes = await collection.where({open_id: fromUserName}).remove()
                        if(unbindRes.hasOwnProperty('code')){
                            content = '解绑失败'
                        }else{
                            content = '解绑成功（回复 /newuser KEY,HTTPUrl 重新绑定。）'
                        }
                        break
                    default :
                        var cloudHttpUrl = user.data[0].cloud_httpurl,
                            cloudKey = user.data[0].cloud_key
                        
                        if (content.slice(0,1) == '/') {
                            if (content == '/u' || content.substr(0,5) == '/u'){
                                let unNumb = 1
                                if(/^\/u[, ]([1-9]\d*)$/.test(content)){
                                    let result = content.match(/^\/u[, ]([1-9]\d*)$/)
                                    unNumb = result[1]
                                }
                                var res = await cloudRequest(cloudHttpUrl,cloudKey,content)
                                if(res.statusCode == 200){
                                    content = '已删除 '+unNumb+' 条！'
                                }else{
                                    content = '撤消失败！'
                                }
                            }else if(/^\/d([1-9])$/.test(content)){ //删除第几条
                                var res = await cloudRequest(cloudHttpUrl,cloudKey,content)
                                if(res.statusCode == 200){
                                    content = '已删除'
                                }else{
                                    content = '撤消失败！'
                                }
                            }else if (content == '/l' ){
                                var res = await cloudRequest(cloudHttpUrl,cloudKey,content)
                                //console.log(JSON.parse(res.body).content)
                                if(res.statusCode == 200){
                                    content = JSON.parse(res.body).content
                                }else{
                                    content = '查询失败！'
                                }
                            }else{
                                content = '无此命令，回复 /h 查看更多'
                            }
                        }else{
                            //处理图片消息
                            if (msgType == 'image') {
                                test_media_id = mediaId
                                await getPicUrl(wxappid, wxappsecret, test_media_id)
                                content = await uploadPic7bu(test_media_id)
                            }
                            var res = await cloudRequest(cloudHttpUrl,cloudKey,content)
                            console.log(res)
                                if(res.statusCode == 200){
                                    if (msgType == 'text') {
                                        content = '嘀咕成功！（回复 /h 查看命令）'
                                    } else if (msgType == 'image') {
                                        content = '图片发送成功！（回复 /h 查看命令）'+content
                                    }
                                }else{
                                    content = '嘀咕失败！'+res.statusCode
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
    try{
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
                resoved(res)
            }
        })
    } catch (err) {
            console.log(err)
    }
    })
}

//获取access_token函数
function getAccess_token(aid, asecret) {
    return new Promise(function (resolved, rejected) {
    try{
        request({
            url: 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + aid + '&secret=' + asecret,
            method: 'GET'
        }, function (error, res, body) {
            if (error) {
                rejected(error)  
            } else {
                res = JSON.parse(body)
                resolved(res.access_token)
            }
        })
    } catch (err) {
            console.log(err)
    }
    })
}

//获取微信临时素材后缀
function getvxImghouzhui(wxtoken, test_media_id) {
    return new Promise(function (resoved, rejected) {
    try{
        request({
            url: 'https://api.weixin.qq.com/cgi-bin/media/get?access_token=' + wxtoken + '&media_id=' + test_media_id,
            method: 'GET'
        }, function (error, res, body) {
            if (error) {
                rejected(error)
            } else {
                imgtype = res.caseless.dict['content-type']
                var houzhui = ''
                if (imgtype == 'image/jpeg') {
                    houzhui = 'jpg'
                } else if (imgtype == 'image/png') {
                    houzhui = 'png'
                } else if (imgtype == 'image/webp') {
                    houzhui = 'webp'
                } else if (imgtype == 'image/gif') {
                    houzhui = 'gif'
                }
                resoved(houzhui)
            }
        })
    } catch (err) {
            console.log(err)
    }
    })
}

//下载微信临时素材图片
function downloadPic(picUrl, test_media_id, houzhui) {
    return new Promise((r,e)=>{
    try {
        //改为下载至tmp临时空间
        const ws = fs.createWriteStream('/tmp/'+test_media_id+'.'+houzhui, { autoClose: true });
        request(picUrl).pipe(ws);
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

//获取微信临时素材图片url
async function getPicUrl(wxappid, wxappsecret, test_media_id) {
    wxtoken = await getAccess_token(wxappid, wxappsecret)
    houzhui = await getvxImghouzhui(wxtoken, test_media_id)
    //buUrl = await uploadPic7bu(test_media_id)
    picUrl = 'https://api.weixin.qq.com/cgi-bin/media/get?access_token=' + wxtoken + '&media_id=' + test_media_id
    //下载图片到临时文件夹tmp
    await downloadPic(picUrl,test_media_id,houzhui)
    //console.log('wxtoken: ' + wxtoken)
    //console.log('houzhui: ' + houzhui)
    //console.log('picurl: ' + picUrl)
}

function uploadPic7bu(test_media_id) {
    return new Promise(function (resolved, rejected) {
        var formData = {
            'image': fs.createReadStream('/tmp/'+test_media_id+'.jpg'),
        }
        request({
            url: 'https://7bu.top/api/upload',
            method: 'POST',
            formData:formData
        }, function (error, res, body) {
            if (error) {
                rejected(error)  
            } else {
                res = JSON.parse(body)
                console.log('上传至7不图床成功！', res.data.url )
                deleteFolderRecursive('/tmp')
                resolved(res.data.url)
            }
        })
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
 

