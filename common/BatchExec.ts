import * as fs from 'fs';
import * as path from 'path';
import { BehaviorNodeModel, BehaviorTreeModel } from './BehaviorTreeModel';



export default (scriptPath: string, dirPath: string) => {
    console.log("run script", scriptPath);
    const str = fs.readFileSync(scriptPath, "utf8");
    const script = eval(str);
    const batchExec = (filePath: string) => {
        const files = fs.readdirSync(filePath);
        files.forEach((filename) => {
            var filedir = path.join(filePath, filename);
            const stats = fs.statSync(filedir);
            if (stats.isFile() && filename.match(/.\.json$/)) {
                const str = fs.readFileSync(filedir, "utf8");
                let tree: BehaviorTreeModel = JSON.parse(str);
                if (script.processTree) {
                    tree = script.processTree(tree);
                }
                if (tree && script.processNode) {
                    const processNode = (node: BehaviorNodeModel) => {
                        script.processNode(node, tree);
                        if (node.children) {
                            for (let child of node.children) {
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
        });
    }
    batchExec(dirPath);
    console.log("run script", scriptPath, "done!");
}