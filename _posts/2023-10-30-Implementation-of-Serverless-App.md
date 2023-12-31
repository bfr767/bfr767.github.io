In this post I will be implementing a servless application via AWS services by Adrian Cantrill

This project will involve the usage of Python, Simple Email Services (SES),Step Functions, IAM, Lambda, API Gateway, CloudWatch, CloudFormation, and S3 Static Website

First we are going to utilize the Simple Email Services and we will be needing two different emails as you need one as the sender and the other to recieve.

(SES - Simple Email Services)

1.Go to "Verified Identities" then to "Create Identity"
2.Click "Email Address" option" and enter one of your emails below, click the link that was sent to your email and become verified
3.Repeat Step 2 with a different email, decide which one you want to be the sender and the other the reciever.

Recap: We utilized the SES of AWS to configure and verify our designated emails into the architecture.

Second: We'll be adding lambda and some configuration to allow our state machine to use the SES

(CloudFormation)

1. Provided a Preset Stack from Adrian Cantrill to allow the lambda role.

(IAM)

2. Go to "Roles" and look for "LAMBDAROLE" in the list of roles, click it to verify its "trust policies" and "permissions

(LAMBDA)

1. CLick "Create Function", leave on default "Author from Scratch", name it and below change "Runtime" to python (3.11), Click the "Permissions" arrow below that and choose "existing role" and choose your Lambda role from before and hit "Create Function".
2. Go below to the python file and delete it and copy/paste this: 

import boto3, os, json

FROM_EMAIL_ADDRESS = 'REPLACE_ME'

ses = boto3.client('ses')

def lambda_handler(event, context):
    # Print event data to logs .. 
    print("Received event: " + json.dumps(event))
    # Publish message directly to email, provided by EmailOnly or EmailPar TASK
    ses.send_email( Source=FROM_EMAIL_ADDRESS,
        Destination={ 'ToAddresses': [ event['Input']['email'] ] }, 
        Message={ 'Subject': {'Data': 'Whiskers Commands You to attend!'},
            'Body': {'Text': {'Data': event['Input']['message']}}
        }
    )
    return 'Success!'

Explaination: This code will import the libraries that will allow this to execute. Utilizing the Boto3 client, it sends an email using data that is passed ot it by the state machine. 
So when this lambda function is invoked by the state machine it's given this event object and inside this object will be the destination email address to send to as well as a brief message.

3. Replace the "REPLACE_ME" but leave the quotes and replace it with one of the emails from earlier, this will be your sender email
4. Hit "Deploy" above the python code and wait for it to update, take note of your ARN as you will need it later.

Recap: Created a email reminder lambdda function and given it permissions that it requires to interac with the SES service. 
You've edited the placeholder that it will send email from the address that you verified inside the SES service.

Third, We are going to get a State machine going through the Step Functions service. This will integrate wit the SES and Lambda functions to wait a certain time to send the email.

(IAM)

1. Create an IAM role that the state machine will use to interact with other services

(Step Functions)

2.Click "State Machines" then Click "Create State Machine"
3. Select "Blank", click the "Code" tab, now input JSON template for the State Machine from ASL (Amazon States Language)

JSON template:

{
  "Comment": "Pet Cuddle-o-Tron - using Lambda for email.",
  "StartAt": "Timer",
  "States": {
    "Timer": {
      "Type": "Wait",
      "SecondsPath": "$.waitSeconds",
      "Next": "Email"
    },
    "Email": {
      "Type" : "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "EMAIL_LAMBDA_ARN",
        "Payload": {
          "Input.$": "$"
        }
      },
      "Next": "NextState"
    },
    "NextState": {
      "Type": "Pass",
      "End": true
    }
  }
}

4. Replace "EMAIL_LAMBDA_ARN" with the ARN from earlier, hit the "Config" tab, click standard, set perimissions to role created in step 1, change "Logging" to all, hit "Create"
5. Take note of the ARN for the State Machine as you will need it for the next part

Recap" You've created the IAM role for the state machine, created the state machine itself, updated the place holder for the statemachine to integrate with the lambda function
that is used to send the email notification.

Fourth, we are going to be adding the API Gateway and the supporting Lambda function. The API gateway will give an endpoint for your client application to use to talk to our application.
We'll be creating the API itself, a method on that API, which is how the client application can interact with the API, we'll be creating a Lambda function which provides the 
compute required to service that API.

(Lambda Services)

1. "Create function", "Create from Scratch", Name the function, "Runtime" python (3.11), choose "existing role" for LambdaRole under permissions, click "Create function".
2. Replace the code for the Lamda with python code

Python code: 

import boto3, json, os, decimal

SM_ARN = 'YOUR_STATEMACHINE_ARN'

sm = boto3.client('stepfunctions')

def lambda_handler(event, context):
    # Print event data to logs .. 
    print("Received event: " + json.dumps(event))

    # Load data coming from APIGateway
    data = json.loads(event['body'])
    data['waitSeconds'] = int(data['waitSeconds'])
    
    # Sanity check that all of the parameters we need have come through from API gateway
    # Mixture of optional and mandatory ones
    checks = []
    checks.append('waitSeconds' in data)
    checks.append(type(data['waitSeconds']) == int)
    checks.append('message' in data)

    # if any checks fail, return error to API Gateway to return to client
    if False in checks:
        response = {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin":"*"},
            "body": json.dumps( { "Status": "Success", "Reason": "Input failed validation" }, cls=DecimalEncoder )
        }
    # If none, start the state machine execution and inform client of 2XX success :)
    else: 
        sm.start_execution( stateMachineArn=SM_ARN, input=json.dumps(data, cls=DecimalEncoder) )
        response = {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin":"*"},
            "body": json.dumps( {"Status": "Success"}, cls=DecimalEncoder )
        }
    return response

# This is a workaround for: http://bugs.python.org/issue16535
# Solution discussed on this thread https://stackoverflow.com/questions/11942364/typeerror-integer-is-not-json-serializable-when-serializing-json-in-python
# https://stackoverflow.com/questions/1960516/python-json-serialize-a-decimal-object
# Credit goes to the group :)
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj)
        return super(DecimalEncoder, self).default(obj)

3. Replace "YOUR_STATEMACHINE_ARN" with the ARN from the State machine, and hit "Deploy", make sure to take note of the ARN from this Lambda

(API Gateway)

4. Click "APIs" then scroll to "REST API" and hit "Build"
5.Click "New API" , name API, Select "Regional", and click "Create API"
6. Click "Create resource", name Resource, enable "CORS", click "Create resource"
7.Go down and click "Create method", set "Method type" to POST, "Integration type", enable "Lambda proxy integration", insert ARN of the Lambda from earlier
make sure "Default Timer" is enabled, click "Create method"
8. Click "Deploy API", click "stage" and create New Stage, name it "prod", description put "prod" and create
9. Copy "Invoke URL"

Fifth (Final Step), We'll be adding the final piece which is the client side of the application. Which will utilize the S3 bucket static website capabilities

(S3 Services)

1. Click "Create bucket", name the bucket, uncheck "Block All access" and acknowledge it below, then click "Create bucket"
2. Go down to "Bucket policy" and click "Edit", and insert JSON data

JSON data:

{
    "Version":"2012-10-17",
    "Statement":[
      {
        "Sid":"PublicRead",
        "Effect":"Allow",
        "Principal": "*",
        "Action":["s3:GetObject"],
        "Resource":["REPLACEME_PET_CUDDLE_O_TRON_BUCKET_ARN/*"]
      }
    ]
  }

3. Replace "REPLACEME_PET_CUDDLE_O_TRON_BUCKET_ARN" leave the forward slash and star, replace it with your S3 bucket ARN, and then hit "Save"
4. Make sure you are in the bucket and go to the "Properties" tab and scroll down to "Static Website hosting" and enable it, also put index.html in both index and error, then hit "Save changes"

(API Gateway Services)

5. Copy the "Invoke URL" of the Stage you made earlier, and use it to replace placeholder and add after it "/MYAPINAMEHERE", do this all in the Javascript below.

Javascript:


var API_ENDPOINT = 'https://dsaelug0q4.execute-api.us-east-1.amazonaws.com/prod/petcuddleotron';
// if correct it should be similar to https://somethingsomething.execute-api.us-east-1.amazonaws.com/prod/petcuddleotron

var errorDiv = document.getElementById('error-message')
var successDiv = document.getElementById('success-message')
var resultsDiv = document.getElementById('results-message')

// function output returns input button contents
function waitSecondsValue() { return document.getElementById('waitSeconds').value }
function messageValue() { return document.getElementById('message').value }
function emailValue() { return document.getElementById('email').value }

function clearNotifications() {
    errorDiv.textContent = '';
    resultsDiv.textContent = '';
    successDiv.textContent = '';
}

// When buttons are clicked, this is run passing values to API Gateway call
document.getElementById('emailButton').addEventListener('click', function(e) { sendData(e, 'email'); });

function sendData (e, pref) {
    e.preventDefault()
    clearNotifications()
    fetch(API_ENDPOINT, {
        headers:{
            "Content-type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify({
            waitSeconds: waitSecondsValue(),
            message: messageValue(),
            email: emailValue()
        }),
        mode: 'cors'
    })
    .then((resp) => resp.json())
    .then(function(data) {
        console.log(data)
        successDiv.textContent = 'Submitted. But check the result below!';
        resultsDiv.textContent = JSON.stringify(data);
    })
    .catch(function(err) {
        errorDiv.textContent = 'Oops! Error Error:\n' + err.toString();
        console.log(err)
    });
};

(S3 Bucket Services)

6. Add all files from Adrian and upload them to S3 Bucket
7.Once Complete, go to "Properties" scroll down to the bottom and open the url link for your S3 bucket
8. Now you can test the App and see how it functions with the verified emails from earlier.
