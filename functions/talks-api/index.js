'use strict';
const serverkey = 'Your-API-Key' //自定义api key
//引入模块
const tcb = require("@cloudbase/node-sdk");
//云开发初始化
const app = tcb.init({
  env: "env-ID" //填入自己的环境ID
});
//数据库初始化
const db = app.database()
exports.main = async (event, context) => {
    //return event
    let apikey = event.queryStringParameters.key
    let content = ''
    if(serverkey == apikey ){
        const talksCollection = db.collection('talks') // 云开发数据库名称
        //提取消息内容，发送者，接受者，时间戳，消息类型，内容
        var CreateTime = Date.now(),
            Content = event.queryStringParameters.text,
            From = event.queryStringParameters.from
        if(Content == '/del'){ //删除最新一条哔哔
            const res = await talksCollection.where({}).orderBy("date", "desc").limit(1).get()
            let deId = res.data[0]._id
            const resDe = await talksCollection.doc(deId).remove();
            if(resDe.hasOwnProperty('deleted')){
                content = '删除成功'
            }else{
                content = '删除失败'
            }
        }else{
            var result = await talksCollection.add({content: Content, date: new Date(CreateTime), from: From})
            if(result.hasOwnProperty('id')){
                content = '发表成功（回复 /help 查看命令）'
            }else{
                content = '发表失败'
            }
        }
    }else{
        content = "Key 不匹配"
    }
    return {
        content
    };
}