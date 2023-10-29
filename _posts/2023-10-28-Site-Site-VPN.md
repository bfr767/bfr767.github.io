## This is my first blog post
I will be setting up a Site2SiteVPN for this project.
The AWSs that will used the most are EC2, VPC, and CloudFormation.
I have subscribed to the Pfsense firewall for AWS as that will come later on during this project.

**Setup:** I will be using a prepared stack via CloudFormation by Adrian Cantril, but I will be creating my own key pair as per required for this project.

**AWS VPN:** The initial parts of this project will be more focused on the AWS architecture before we eventually get to the endhost/client side. I'll be setting up a CGW (Customer Gateway) and VPG (Virtual Private Gateway) that will also consist of two different end points in different AZs (Availability Zones) for the AWS Network. This will allow access for the client to the VPC (Virtual Private Cloud) via VPN (Virtual Private Network) tunnel.

**(VPC Services)**
1. I start by creating both the CGW and VPG. I then attach the VPG to the VPC.
2. Create the VPN connection (Site-to-Site VPN connections) using static as this is Site2Site meaning only two devices required for VPN. I'll be using 192.168.8.0/21 as this is a pirvate address and allows for this allows for more changes to be made while also being efficient with network space.
3. After click the Connection and click "Download Configuration" and set it to pfSense and then create. This will give an important document for setup in the next step.

Recap: I have made two gateways, one for the client onprem and the other for the AWS VPC. This has created two endpoints on the network by having them as VPN tunnels for both to communicate securely.

**ONPREMISE pfSense Config:** In this part I will be focusing on the onprem architecture of this project. I will be setting up the pfsense router (CGW) for both the WAN and LAN that will allow the two VPN tunnel endpoints to become operational and security for our onprem server. Which will also allow our architecture to become highly available through different AZs.

**(EC2 Services)**
1. We are going to need the password for the router for the pfsense configuration. Which can be accessed my right-click and going to "Monitor and troubleshoot>Get Systemlog". We will need this to login to pfsense configuration site.
**(pfSense site)**
2. There we will go to Interfaces and add another entry which will become the LAN. Click Interfaces again, and set it up with DHCP then save and apply changes.
3. Next Click VPN, and we are going to setup the phase 1 and phase 2 VPN tunnels for our endpoints.
4. Here you will need to add the Remote Gateway address and PSK (Pre-Shared Key) from the document in last stage on step 3 all under "IPSEC Tunnel 1". Set "Encryption Algorithm" Key length to 128 bits, key group to 2(1024) bit, Hash Algorithm to SHA1, then in "Advanced Options" change MAx Failures to 3 and then save. This setup phase one tunnel endpoint 1.
5. Click just below it to add phase 2 configurations. Go to "Networks" and change Local Network to Network with an address of 192.168.10.0/24 and change Remote Network to Network with an address of 10.16.0.0/16. in "Phase 2 Proposal" make sure AES128, SHA1 are enabled, and PFS Keygroup is set to 2(1024) bit. Go to "Keep Alive" in the Automatically ping host put the Private IPv4 Address from the awsServerA EC2 instance here. Then enable Keep Alive just below that and then save. This completes the AWS configuration of endpoint 1.
6. We are basically going to be repeating the steps we have done for the endpoint 1 configuration and do them on endpoint 2. All information will now be under "IPSEC Tunnel 2" this time.
7. Remember to apply changes and under "Status" go to IPSec and manually connect both tunnels.

Recap: We established a LAN interface. We have setup our two endpoints for our VPN tunnels Phase 1 & Phase 2, and this establishes our WAN. We also manually established our endpoint connections and now the router instance is able to communicate with the VPG via VPN.

**Routing & Security:** 
**(VPC Services)**
1. We will establish our newly added routes to our VPC by going to Route tables. Then we will edit our AWS route table by enabling routing propagation. This will allow the AWS side of the architecture via our VPG to add the onprem network to its route table.
2.Go back to route tables and we shall edit the route table of our onprem private instance. This time by adding an ENI (Elastic Network Interface) with 10.16.0.0/16 that we established in our "ONPREMISE pfSense Config". Now we have to where both our onprem and vpc are able to reach each other via their respective route tables. Now the issue is customizing our security group for proper communication.
3. Now go to Security section and click Security groups. We are going to edit our AWS SG (Security Group) by editing the "InBound Rules" and adding a rule by allowing "All Traffic" and allowing the network 192.168.0.0/21. This will allow anything with the onprem network range to connect with our AWS infrastructure.
4. We shall do the same for our OnPrem SG by editing "InBound Rules" and adding a rule by allowing "All Traffic" and allow the network 10.16.0.0/16. This will allow anything within the VPC to connect with our OnPrem.
5. Then we do the same for our Router instance. This time in "Inbound Rules" we shall allow "All Traffic" and allow the default SG of our onPrem. Which will allow our subnets to use VPN.

Recap: We setup our routing tables which will allow our AWS and Onprem to reach via their routing tables. We edited our SGs to allow the specific networks to have access to our infrastructure.

**Testing:** We need to test and see if all our configurations are correct.
**(EC2 Services)**
1. Right Click and click connect on our OnPrem Server. Click "RDP Client" and we are going to connect Fleet Manager via SSM (Simple Systems Manager) by obtaining our password. That key pair that we established at the beginning should be uploaded here so you can decrypt the password. This you are now able to connect by Fleet Manager by inputting your credentials. 
