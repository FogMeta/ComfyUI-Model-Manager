const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import cors module
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;
// 部署在2080 显卡
// Use cors middleware to enable CORS
app.use(cors());
app.use(bodyParser.json());

// Function to read file and return its content
function readFileContent(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
}


function readFileContent(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
}
// API endpoint to get file content
app.get('/file-content', (req, res) => {

    const filePath = path.join(__dirname, 'custom_model.txt'); // File path
    readFileContent(filePath)
        .then(content => {
            res.send(content);
        })
        .catch(error => {
            res.status(500).send('Error reading file: ' + error.message);
        });
});

app.post('/download', (req, res) => {
    const url = req.body.url;
    var directory = req.body.directory;
    const filename = req.body.filename; // User-specified filename

    if (!url) {
        return res.status(400).send('No URL provided');
    }

    if (!directory) {
        return res.status(400).send('No directory provided');
    }
    
    if (!filename) {
        return res.status(400).send('No filename provided');
    }
    
    const comfyUIDir = path.resolve(__dirname + '/../../../');
    const safePath = path.resolve(comfyUIDir + '/' + directory) + '/';

    directory = comfyUIDir + '/' + directory;
    console.log("Safe Path: " + safePath)
    console.log("Directory: " + directory)
    
    if (!safePath.startsWith(directory)) {
        return res.status(400).send('Invalid directory path');
    }
    if (!fs.existsSync(safePath)) {
        fs.mkdirSync(safePath, { recursive: true });
    }
    // Construct aria2c command
    const aria2cCommand = `aria2c --dir="${safePath}" --out="${filename}" "${url}"`;

    // Execute aria2c command and wait for it to finish
    new Promise((resolve, reject) => {
        const downloadProcess = exec(aria2cCommand);

        downloadProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        downloadProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        downloadProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(`aria2c process exited with code ${code}`);
            }
        });
    })
    .then(() => {
        // Write download history to custom_model.txt
        // Get file size
        var stats = fs.statSync(safePath + "/" + filename);
        var fileSizeInBytes = stats.size;

        // Convert the file size to gigabyte (optional)
        var fileSizeInMegabytes = (fileSizeInBytes / Math.pow(1024,3)).toPrecision(3);

        // Check if custom_model.txt exists
        if (!fs.existsSync(__dirname + '/custom_model.txt')) {
            fs.writeFile('custom_model.txt', 'Path,Size (GB),URL', {flag: 'w', encoding: "utf8",}, (err) => {
                if (err) {
                    throw err;
                }
                console.log("File is created.");
            });
        }
        // Append to custom_model.txt
        fs.writeFile('custom_model.txt','\n' + safePath + '/' + filename + ',' + fileSizeInMegabytes +',' + url, {flag: 'a+', encoding: "utf8",}, (err) => { 
            if (err) { 
            throw err; 
            } 
            console.log("File is updated."); 
            });
        res.send(`SUCCESS! Model downloaded to ${directory}`);
    })
    .catch((error) => {
        res.status(500).send(`ERROR! Download failed: ${error}`);
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
