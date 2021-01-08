/**
 * 个人哔哔接口程序
 * date: 2021.01.08
**/

'use strict';
//自定义api key
const serverkey = 'xxxx'
//引入模块
const tcb = require("@cloudbase/node-sdk");
//云开发初始化
const app = tcb.init({
  env: "xxxxx"
});

//数据库初始化
const db = app.database()

exports.main = async (event, context) => {
    //return event
    let apikey = event.queryStringParameters.key
    let content = ''
    if(serverkey == apikey ){
        const talksCollection = db.collection('talks')
        //提取消息内容，发送者，接受者，时间戳，消息类型，内容
        var CreateTime = Date.now(),
            Content = event.queryStringParameters.text,
            From = event.queryStringParameters.from
        if(Content == '/l'){ //查询
            var resData = ''
            const res = await talksCollection.where({}).orderBy("date", "desc").limit(9).get().then((res) => {
                for(var i=1;i<=res.data.length;i++){
                    console.log(res.data[i-1]);
                    resData += '/d'+i+' '+res.data[i-1].content+'\n'
                }
            });
            content = resData
        }else if(/^\/d([1-9])$/.test(Content)){ //删除第几条
            let result = Content.match(/^\/d([1-9])$/)
            let skipBb = result[1]-1
            const res = await talksCollection.where({}).orderBy("date", "desc").skip(skipBb).limit(1).get()
            let deId = res.data[0]._id
            //console.log('deId'+deId)4
            const resDe = await talksCollection.doc(deId).remove();
            content = '已删除第'+result[1]+ '条'
        }else if(Content == '/u' || Content.substr(0,5) == '/u'){ //删除哔哔
            let unNumb = 1
            if(/^\/u[, ]([1-9]\d*)$/.test(Content)){
                let result = Content.match(/^\/u[, ]([1-9]\d*)$/)
                unNumb = result[1]
            }
            for(var i=1;i<=unNumb;i++){
                    const res = await talksCollection.where({}).orderBy("date", "desc").limit(1).get()
                    let deId = res.data[0]._id
                    const resDe = await talksCollection.doc(deId).remove();
            }
            content = '已删除 '+unNumb+' 条'
        }else{
            var result = await talksCollection.add({content: Content, date: new Date(CreateTime), from: From})
            if(result.hasOwnProperty('id')){
                content = '发表成功'
            }else{
                content = '发表失败'
            }
        }
    }else{
        content = "key不匹配"
    }
    return {
        content
    };
}