import * as fs from 'fs';
import * as path from 'path';
import { BehaviorNodeModel, BehaviorTreeModel } from './BehaviorTreeModel';



export default (scriptPath: string, dirPath: string) => {
    console.log("script", scriptPath);
    const str = fs.readFileSync(scriptPath, "utf8");
    const script = eval(str);
    const batchExec = (filePath: string) => {
        fs.readdir(filePath, (err, files) => {
            if (err) {
                console.warn(err)
            } else {
                files.forEach((filename) => {
                    var filedir = path.join(filePath, filename);
                    fs.stat(filedir, (err, stats) => {
                        if (err) {
                            console.warn('获取文件stats失败', err);
                        } else {
                            if (stats.isFile() && filename.match(/.\.json$/)) {
                                const str = fs.readFileSync(filedir, "utf8");
                                let tree: BehaviorTreeModel = JSON.parse(str);
                                if(script.processTree) {
                                    tree = script.processTree(tree);
                                }
                                if(tree && script.processNode) {
                                    const processNode = (node: BehaviorNodeModel) => {
                                        script.processNode(node);
                                        if(node.children) {
                                            for(let child of node.children) {
                                                processNode(child);
                                            }
                                        }  
                                    }
                                    processNode(tree.root);
                                }
                                if (tree) {
                                    fs.writeFileSync(
                                        filedir,
                                        JSON.stringify(tree)
                                    );
                                }

                            }
                            if (stats.isDirectory()) {
                                batchExec(filedir);
                            }
                        }
                    })
                });
            }
        });
    }
    batchExec(dirPath);
}