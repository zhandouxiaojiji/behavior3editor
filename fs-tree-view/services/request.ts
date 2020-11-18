import * as axios from "axios";


function encodeUrlParam(s: string) {
    return encodeURIComponent(s);
}

const BASE_URL = process.env.fsTreeViewUrl || "http://localhost:5000";

const tree = async (dirPath: string) => {
    const response = await axios.default.get(`${BASE_URL}/?path=${encodeUrlParam(dirPath)}`);
    return response.data;
};

const search = async (dirPath: string, query: string) => {
    const response = await axios.default.get(
        `${BASE_URL}/search?query=${encodeUrlParam(query)}&path=${encodeUrlParam(dirPath)}`
    );
    return response.data;
};

const dragDrop = async (args: { source: string; destination: string; overwrite: boolean }) => {
    const response = await axios.default.post(`${BASE_URL}/dragdrop`, {
        source : encodeUrlParam(args.source),
        destination : encodeUrlParam(args.destination),
        overwrite:args.overwrite
    });
    return response;
};

const renameNode = async (args: { oldPath: string; newFileName: string }) => {
    const response = await axios.default.put(`${BASE_URL}/rename`, {
        oldPath : encodeUrlParam(args.oldPath),
        newFileName : encodeUrlParam(args.newFileName),
    });
    return response;
};

const deleteNode = async (fullPath : string) => {
    const encodeFullPath = encodeUrlParam(fullPath);
    const response = await axios.default.delete(`${BASE_URL}`, {
        params: { fullPath:encodeFullPath },
    });
    return response;
};

export default {
    tree,
    search,
    dragDrop,
    renameNode,
    deleteNode,
};
