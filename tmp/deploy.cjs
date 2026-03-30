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
    const ec2Origin = '13.233.186.145';

    console.log(`Creating S3 bucket: ${bucketName}...`);
    runCmd(`${awsCmd} s3api create-bucket --bucket ${bucketName} --region ${region} --create-bucket-configuration LocationConstraint=${region}`);

    runCmd(`${awsCmd} s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true`);

    console.log('Uploading frontend to S3...');
    runCmd(`${awsCmd} s3 sync dist/ s3://${bucketName}`);

    console.log('Creating CloudFront Origin Access Control (OAC)...');
    
    fs.writeFileSync('oac-config.json', JSON.stringify({
        OriginAccessControlConfig: {
            Name: `oac-${bucketName}`,
            Description: 'OAC for TrainFlow',
            OriginAccessControlOriginType: 's3',
            SigningBehavior: 'always',
            SigningProtocol: 'sigv4'
        }
    }));
    const oacRes = JSON.parse(runCmd(`${awsCmd} cloudfront create-origin-access-control --cli-input-json file://oac-config.json`));
    const oacId = oacRes.OriginAccessControl.Id;
    console.log(`OAC ID: ${oacId}`);

    console.log('Creating CloudFront distribution...');
    const bucketDomain = `${bucketName}.s3.${region}.amazonaws.com`;
    const callerReference = `trainflow-deploy-${Date.now()}`;

    const distConfig = {
        CallerReference: callerReference,
        Comment: 'TrainFlow Dashboard Frontend and API Routing',
        Enabled: true,
        DefaultRootObject: 'index.html',
        Origins: {
            Quantity: 2,
            Items: [
                {
                    Id: 'S3Origin',
                    DomainName: bucketDomain,
                    S3OriginConfig: {
                        OriginAccessIdentity: ''
                    },
                    OriginAccessControlId: oacId
                },
                {
                    Id: 'EC2Origin',
                    DomainName: ec2Origin,
                    CustomOriginConfig: {
                        HTTPPort: 80,
                        HTTPSPort: 443,
                        OriginProtocolPolicy: 'http-only',
                        OriginSslProtocols: { Quantity: 1, Items: ['TLSv1.2'] }
                    }
                }
            ]
        },
        DefaultCacheBehavior: {
            TargetOriginId: 'S3Origin',
            ViewerProtocolPolicy: 'redirect-to-https',
            MinTTL: 0,
            DefaultTTL: 86400,
            MaxTTL: 31536000,
            ForwardedValues: {
                QueryString: false,
                Cookies: { Forward: 'none' }
            }
        },
        CacheBehaviors: {
            Quantity: 1,
            Items: [
                {
                    PathPattern: '/api/*',
                    TargetOriginId: 'EC2Origin',
                    ViewerProtocolPolicy: 'redirect-to-https',
                    AllowedMethods: {
                        Quantity: 7,
                        Items: ['HEAD', 'DELETE', 'POST', 'GET', 'OPTIONS', 'PUT', 'PATCH']
                    },
                    MinTTL: 0,
                    DefaultTTL: 0,
                    MaxTTL: 0,
                    ForwardedValues: {
                        QueryString: true,
                        Cookies: { Forward: 'all' },
                        Headers: { Quantity: 1, Items: ['*'] }
                    }
                }
            ]
        },
        CustomErrorResponses: {
            Quantity: 1,
            Items: [
                {
                    ErrorCode: 404,
                    ResponsePagePath: '/index.html',
                    ResponseCode: '200',
                    ErrorCachingMinTTL: 300
                }
            ]
        }
    };

    fs.writeFileSync('cf-config.json', JSON.stringify({ DistributionConfig: distConfig }, null, 2));

    let cfDomain = '';
    let cfArn = '';
    try {
        const cfRes = JSON.parse(runCmd(`${awsCmd} cloudfront create-distribution --cli-input-json file://cf-config.json`));
        cfDomain = cfRes.Distribution.DomainName;
        cfArn = cfRes.Distribution.ARN;
        console.log(`CloudFront Distribution Created: https://${cfDomain}`);
    } catch (e) {
        console.error('Failed to create CloudFront Distribution.');
        process.exit(1);
    }

    console.log('Writing S3 Bucket Policy to allow OAC...');
    const bucketPolicy = {
        Version: '2012-10-17',
        Statement: {
            Sid: 'AllowCloudFrontServicePrincipalReadOnly',
            Effect: 'Allow',
            Principal: {
                Service: 'cloudfront.amazonaws.com'
            },
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucketName}/*`,
            Condition: {
                StringEquals: {
                    'AWS:SourceArn': cfArn
                }
            }
        }
    };
    fs.writeFileSync('bucket-policy.json', JSON.stringify(bucketPolicy));
    runCmd(`${awsCmd} s3api put-bucket-policy --bucket ${bucketName} --policy file://bucket-policy.json`);

    console.log('Deployment script complete!');
    console.log(`CF_URL:https://${cfDomain}`);
}

deploy();
