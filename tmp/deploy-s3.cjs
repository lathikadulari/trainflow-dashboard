const { execSync } = require('child_process');
const fs = require('fs');

const awsCmd = '"C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe"';

function runCmd(cmd) {
    console.log(`Running: ${cmd}`);
    try {
        const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        return output.trim();
    } catch (e) {
        console.error(`Command failed: ${cmd}\nError: ${e.message}\n${e.stderr}\n${e.stdout}`);
        process.exit(1);
    }
}

async function deploy() {
    const bucketName = `trainflow-frontend-${Date.now()}`;
    const region = 'ap-south-1';

    console.log(`Creating S3 bucket: ${bucketName}...`);
    runCmd(`${awsCmd} s3api create-bucket --bucket ${bucketName} --region ${region} --create-bucket-configuration LocationConstraint=${region}`);

    console.log('Disabling public access block...');
    runCmd(`${awsCmd} s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false`);

    console.log('Applying public read policy...');
    const policy = {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "PublicReadGetObject",
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${bucketName}/*`
            }
        ]
    };
    fs.writeFileSync('public-policy.json', JSON.stringify(policy));
    
    // Sometimes IAM takes a few seconds to apply the public access block before we can set the policy.
    // Adding a small delay just to be safe.
    await new Promise(r => setTimeout(r, 3000));

    runCmd(`${awsCmd} s3api put-bucket-policy --bucket ${bucketName} --policy file://public-policy.json`);

    console.log('Configuring bucket as a static website...');
    runCmd(`${awsCmd} s3 website s3://${bucketName}/ --index-document index.html --error-document index.html`);

    console.log('Uploading frontend assets to S3...');
    runCmd(`${awsCmd} s3 sync dist/ s3://${bucketName}/`);

    console.log('====================================');
    console.log(`DEPLOYMENT COMPLETE!`);
    console.log(`WEBSITE URL: http://${bucketName}.s3-website.${region}.amazonaws.com/`);
    console.log('====================================');
}

deploy();
