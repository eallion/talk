### HTTP post 请求格式：
```
https://tcb.eallion.com/talk?&key=TOKEN&from=FROM&text=CONTENT
```

- key: 云函数中设定的 token 值  
- from: 可自定义  
- text: 嘀咕内容  

### 功能
- /l - 查询最新9条
- /u - 撤销最新一条嘀咕
- /u 数字 - 撤销最新几条嘀咕，如 /u 2