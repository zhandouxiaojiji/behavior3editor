/* 批处理脚本 */
/* 
    如果有processTree，则先运行prcessTree，如果有返回，则进行后面的针对每个节点运行processNode
    如果没有定义processTree，则直接针对每个节点运行processNode
*/
({
    processTree: (tree) => {
        console.log("processTree", tree.name);
        if (tree.name == "hero") {
            return tree;
        }
    },
    processNode: (node) => {
        console.log("processNode", node.id)
    }
})