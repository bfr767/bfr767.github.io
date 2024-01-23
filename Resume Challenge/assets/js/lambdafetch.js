// JavaScript Code

const counter = document.querySelector(".counter-number");
async function updateCounter() {
    let response = await fetch("https://wm54a7xek2dmcfriyyw4nk7era0ksbxb.lambda-url.us-east-1.on.aws");
    let data = await response.json();
    counter.innerHTML = ` Views: ${data}`;
}

updateCounter();