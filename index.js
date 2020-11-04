'use strict';
const mkdirp = require('mkdirp');
const fs = require('fs');
const request = require('request');
const path = require('path');
const url = require('url');
const Promise = require('bluebird');
const chalk = require('chalk');



const TIME_OUT = 5000;


const logRed = function(text){
    console.log(chalk.red(text));
}

const logBlue = function(text){
	console.log(chalk.blue(text));
}

const logGreen = function(text){
	console.log(chalk.green(text));
}



//后缀名配置
const MAP_MIME_TYPE = {
	javascript: "js"
};



/**
 *
 * @param mimeType到后缀名的转换
 * @returns {string|*}
 */
function mapMimiType(tp) {
	return MAP_MIME_TYPE[tp] || tp;
}


/**
 * 解析任务列表
 * @param jsonText
 * @param dist
 * @returns {[]}
 */
function getTasks(jsonText, dist) {
    let har = JSON.parse(jsonText);
    let tasks = [];
    for (let i in har.log.entries) {
        let eobj = har.log.entries[i];
        let urlObj = url.parse(eobj.request.url);

        if (urlObj.pathname.slice(-1) == '/') {
            urlObj.pathname += "index";
        }
        let dirName = path.dirname(urlObj.pathname);
        dirName = path.join(dist, urlObj.host, dirName);

        let fileName = path.basename(urlObj.pathname);
        fileName = fileName.replace(path.extname(fileName), "");

        let extName = eobj.response.content.mimeType.match(/\w*?$/) || [];
        extName = mapMimiType(extName[0]);
		let t = {
			url: eobj.request.url,
			dirName: dirName,
			fileName: fileName,
			extName: extName,
			text: eobj.response.content.text,
			raw: eobj,
			index: i,
		};
        tasks.push(t);
    }
    return tasks;
}



function download(task, callback) {
	return new Promise((resolve, reject) => {
		mkdirp(task.dirName, function(err) {
			let headers = {};
			for (let i in task.raw.request.headers) {
				let headObj = task.raw.request.headers[i];
				headers[headObj.name] = headObj.value;
			}
			let options = {
				url: task.url,
				method: task.raw.request.method
			};
			let req = request(options)
				.on('error', function(err) {
					resolve({err, task});
				})
				.on('end', function() {
					req.finished = true;
				})
			;

			let timeout = setTimeout(__=> {
				if (!req.finished) {
					req.emit("error", "time out:" + task.url);
				}
			}, TIME_OUT);

			req.pipe(
				fs.createWriteStream(
					`${task.dirName}/${task.fileName}.${task.extName}`
				)
			)
				.on('error', function(err) {
					// callback(err);
					resolve({err, task});
				})
				.on('finish', () => {
					clearTimeout(timeout);
					resolve({err: false, task});
				})
			;
		});
	})
}

let index = module.exports = {

	/**
	 * 从路径读取
	 * @param harPath
	 * @param dist
	 * @param timeout
	 * @param callback
	 */
    formFile(harPath, dist, timeout, callback) {
        let har = fs.readFileSync(harPath, 'utf-8');
        return this.fromText(har, dist, timeout, function(err) {
            callback(err);
        });
    },


	/**
	 * 从文本读取
	 * @param jsonText
	 * @param dist
	 * @param timeout
	 * @param callback
	 */
    fromText(jsonText, dist, timeout, callback) {
        if (typeof(timeout) == "function") {
            callback = TIME_OUT;
            timeout = 5000;
        }

        let error = [];
        let tasks = getTasks(jsonText, dist);

        return Promise.map(
			tasks,
			function(task, i, length){
				i = task.index * 1;
				console.log(`正在下载${i+1}/${length}`, task.url);
				return download(task)
					.then(data=>{
						if (data.err) {
							logRed(`下载失败${i+1}/${length}`);
							logRed(task.url);
							logRed(data.err);
							logRed("---");
						}else{
							logBlue(`下载成功${i+1}/${length}`);
							logBlue(task.url);
							logBlue("---");
						}
						return data;
					})
				;
			},

			{concurrency:12},
		).then(resultLs=>{
			const [successLs, failLs] = resultLs.reduce(([ls1, ls2], el, i) => {
				if (el.err) {
					ls2.push(el)
				} else {
					ls1.push(el)
				}
				return [ls1, ls2];
			}, [[], []]);

			logGreen(`---->本次工作完成,共下载${resultLs.length}个文件,其中成功${successLs.length}/失败${failLs.length}<----`);
		})







		//
        // function loop(task) {
        //     download(task, function(data) {
        //         if (data.err) {
        //             error.push(data);
        //         }
        //         let t = tasks.pop();
        //         if (t) {
        //             loop(t);
        //         } else {
        //             callback(error);
        //         }
        //     });
        // }
        // loop(tasks.pop());
    },

	/**
	 * 用来解析命令行参数
	 * @param args
	 */
    init(args) {
        if (args.length !== 2) {
            console.log("har-download  demo.HAR  export/folder");
            return;
        }
		const [source, dist, timeout = TIME_OUT] = args;
		let har = fs.readFileSync(source, 'utf-8');
        return this.fromText(har, dist, timeout, function(err) {
            if (err.length) {
                console.log(err);
            } else {
                console.log("finished");
            }
        });
    }
};
