const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const fs = require("fs");
const fsx = require("fs-extra");
const path = require("path");
const rimraf = require("rimraf");
const glob = require("glob");
const sanitize = require("sanitize-filename");

function decodeUrlParam(s) {
    return decodeURIComponent(s);
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Tree
app.get("/", (req, res) => {
    const dirPath = decodeUrlParam(req.query.path) || "";

    fs.readdir(dirPath, (err, files) => {
        if (!files) {
            console.log("No Files", dirPath);
            return res.json({});
        }

        let finalList = {};
        files.forEach((file) => {
            try {
                const fullPath = path.join(dirPath, file);
                const isDirectory = fs.lstatSync(fullPath).isDirectory();
                let fileProperties = {
                    [fullPath]: {
                        name: file,
                        path: fullPath,
                        size: fs.statSync(fullPath).size,
                        extension: path.extname(file),
                        type: isDirectory ? "directory" : "file",
                        isOpen: false,
                    },
                };

                if (isDirectory) {
                    delete fileProperties[fullPath].extension;
                    fileProperties[fullPath].children = {};
                    // Directories should appear on top
                    finalList = { ...fileProperties, ...finalList };
                } else {
                    // Files should appear at the end
                    finalList = { ...finalList, ...fileProperties };
                }
            } catch (error) {
                console.log("Error:", error);
                return res.json({});
            }
        });

        return res.json(finalList);
    });
});

// Search
app.get("/search", (req, res) => {
    const dirPath = decodeUrlParam(req.query.path) || "";
    let query = decodeUrlParam(req.query.query) || "";
    query = sanitize(query);
    const maxResults = 20;

    glob(`${dirPath}/**/*.*`, {}, function (er, files) {
        const final = [];
        let counter = 0;

        for (const file of files) {
            // Dont show more than maxResults
            if (counter >= maxResults) {
                break;
            }

            let pattern;
            try {
                pattern = new RegExp(query, "gi");
            } catch (error) {
                query = query.replace(/[|&;$%@"<>()+,*]/g, "");
                pattern = new RegExp(query, "gi");
            }

            if (pattern.test(path.basename(file))) {
                final.push({
                    name: path.basename(file),
                    path: file,
                    type: "file",
                    extension: path.extname(file),
                });
                counter++;
            }
        }

        return res.json(final);
    });
});

// For Drag and Drop
app.post("/dragdrop", (req, res) => {
    const { source, destination, overwrite } = req.body;
    const filename = path.basename(source);
    const destinationPath = `${destination}${path.sep}${filename}`;

    fsx.move(source, destinationPath, { overwrite }, (error) => {
        if (error) {
            return res.status(400).send("NOT_OK");
        }

        return res.status(201).send("OK");
    });
});

// Rename a file/folder
app.put("/rename", (req, res) => {
    const oldPath = decodeUrlParam(req.body.oldPath);
    const newFileName = decodeUrlParam(req.body.newFileName);
    const newFilePath = `${path.dirname(oldPath)}${path.sep}${sanitize(newFileName)}`;

    if (oldPath == newFilePath) {
        return res.json({
            newFilePath,
        });
    } else {
        fsx.move(oldPath, newFilePath, { overwrite: false }, (error) => {
            if (error) {
                console.log("Error", error);
                return res.status(400).send("NOT_OK");
            }

            return res.json({
                newFilePath,
            });
        });
    }
});

// Delete file/folder
app.delete("/", (req, res) => {
    rimraf(decodeUrlParam(req.query.fullPath), (error) => {
        if (error) {
            return res.status(400).send(error);
        } else {
            return res.status(200).send("OK");
        }
    });
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
