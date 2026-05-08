





JC371 Communication
Protocol and Data Format

## Version: V1.5.1
## Release Date: Nov 04, 2025


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   I

## Revision History
## Version Date Editor(s) Change Location Remarks
V1.0 Dec. 8. 2020 Tan Senwen Entire document Created the initial draft.
## V1.1 Jun. 2, 2023 Guo Jie 4.2.7
Added the Jimi IoT specific extension to
the pass-through protocol, so all device
parameters can be queried and modified
using pass-through commands.
## V1.1 Aug. 17, 2023 Guo Jie 4.2.7
Added the capability to actively
synchronize parameter changes to the
platform after modifications were made
via SMS, WiFiKit, BLE, or PC Tools.
## V1.1 Jan. 12, 2024 Guo Jie 4.2.7
Added the specific format for the pass-
through command 0xF0.
## V1.2 Sept. 5, 2024
## Zhang
## Chuangjun
## Chapter 7
Added descriptions for the standard
alarm and the E8 extended alarm.
## V1.3 Dec. 17, 2024 Guo Jie
## Chapters 3, 4, 6,
and 7
Added a description of the encryption
method and the packet segmentation.
Added two new tables to Chapter 4:
Definitions of Alarm Flags and
Definitions of Status Bits, providing
comprehensive details on the Alarm flag
and Status fields in 0x0200 message.
Added a new table to Chapter 6:
Definitions of Video Alarm Flags,
clarifying the corresponding video alarm
flags.
Enhanced Chapter 7 with a table
detailing supplementary information IDs
and with descriptions for the custom
extension of positioning data and
timezone information.
## V1.4 Jan. 10, 2025 Guo Jie Appendix
Added an appendix about data examples
for uplink and downlink packets
## V1.4.1 Jun. 26, 2025
## Guo Jie,
## King Wong
Section 7.2.1 Added video alarm ID 0x000C in E8.
## V1.4.2 Aug. 15, 2025
## Guo Jie,
## King Wong
Section 7.2.3 Added basic alarm ID 0x0C1A in E8.
## V1.4.3 Sep. 01, 2025 King Wong
Sections 7.2 and
## 7.3
- Added section 7.3.5.
- Added threes device status IDs –

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   II

## Version Date Editor(s) Change Location Remarks
0x0005, 0x0006, and 0x0007 – to E8
## 0x2005.
- Updated the E8 Extended Alarm Data
Structure Table in Section 7.2.
V1.5.0 Oct 28, 2025 King Wong Chapters 8 and 9
- Added new Chapter 8. (The content of
the previous Chapter 8 has been moved.)
- Moved the content of the previous
Chapter 8 to Chapter 9.
## V1.5.1 Nov 04, 2025 King Wong Chapter 6
Added Section 6.2, and the numbering of
all subsequent sections was automatically
incremented.


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   III

## Contents
- Terms and Abbreviations ............................................................................................................... 1
- Relevant Description ...................................................................................................................... 2
2.1 Notes on Versions ................................................................................................................. 2
2.2 Protocol Extension ................................................................................................................ 2
2.3 Notes on Padding .................................................................................................................. 2
- Protocol Format ............................................................................................................................. 3
3.1 Data Type .............................................................................................................................. 3
3.2 Message Structure ................................................................................................................. 3
3.2.1 General Structure ........................................................................................................ 3
3.2.2 Flag ............................................................................................................................. 4
3.2.3 Message Header.......................................................................................................... 5
3.2.4 Message Body ............................................................................................................ 7
3.2.5 Error Check Code ....................................................................................................... 7
- General Protocols (Message Body) ............................................................................................... 8
4.1 Basic Protocols ..................................................................................................................... 8
4.1.1 General Terminal Response (0x0001) ........................................................................ 8
4.1.2 General Platform Response (0x8001) ........................................................................ 8
4.1.3 Terminal Heartbeat (0x0002) ..................................................................................... 8
4.1.4 Terminal Registration (0x0100 / 0x8100) .................................................................. 9
4.1.5 Terminal Deregistration (0x0003) ............................................................................ 11
4.1.6 Terminal Authentication (0x0102) ........................................................................... 11
4.1.7 Segment Retransmission Request (0x8003 / 0x0005) .............................................. 12
4.2 Terminal Management Protocols ........................................................................................ 12
4.2.1 Terminal Parameter Setup (0x8103) ........................................................................ 14
4.2.2 Terminal Parameter Query (0x8104)........................................................................ 15
4.2.3 Specified Terminal Parameter Query (0x8106) ....................................................... 15
4.2.4 Terminal Parameter Query Response (0x0104) ....................................................... 15
4.2.5 Terminal Control (0x8105) ....................................................................................... 16
4.2.6 TTS Message Delivery (0x8300) ............................................................................. 17
4.2.7 Pass-Through Protocols (0x8900 / 0x0900) ............................................................. 18
4.3 Location Information .......................................................................................................... 20
4.3.1 Location Reporting (0x0200) ................................................................................... 20
4.3.2 Location Query (0x8201) ......................................................................................... 23
4.3.3 Location Query Response (0x0201) ......................................................................... 23
4.3.4 Batch Location Data Upload (0x0704)..................................................................... 23
4.4 Vehicle Control Protocols ................................................................................................... 24
4.5 Vehicle Management Protocols .......................................................................................... 24
- JT/T 808 Multimedia-Related Protocols (Message Body) .......................................................... 25
5.1 Multimedia Event Information Upload (0x0800) ............................................................... 25
5.2 Multimedia Data Upload (0x0801 / 0x8800) ...................................................................... 26

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   IV

5.3 Immediate Capture Command (0x8801 / 0x0805) ............................................................. 27
5.4 Multimedia Data Retrieval (0x8802 / 0x0802) ................................................................... 29
5.5 Single Stored Multimedia Data Retrieval and Upload (0x8805) ........................................ 30
- JT/T 1078-2016 Protocols (Message Body) ................................................................................ 31
6.1 Real-Time Audio and Video Transmission Command (0x9101) ....................................... 31
6.2 Live Audio-Video Streaming and Data Passthrough .......................................................... 32
6.3 Real-time Audio and Video Transmission Control (0x9102) ............................................. 35
6.4 Resource List Query (0x9205) ............................................................................................ 36
6.5 Audio and Video Resource List Upload (0x1205) ............................................................. 37
6.6 Platform-Initiated Remote Video Playback Request (0x9201) .......................................... 38
6.7 File Upload Command (0x9206) ........................................................................................ 39
6.8 File Upload Completion Notification (0x1206).................................................................. 40
6.9 File Upload Control (0x9207)............................................................................................. 40
- Appendix I: 0x0200 Supplementary Info IDs and Extension ...................................................... 41
7.1 Standard Alarms ................................................................................................................. 42
7.1.1 Standard ADAS Alarms ........................................................................................... 42
7.1.2 Standard DMS Alarms ............................................................................................. 45
7.2 E8 Extended Alarms (Custom) ........................................................................................... 46
7.2.1 Video Alarms............................................................................................................ 47
7.2.2 Location/Driving Alarms.......................................................................................... 48
7.2.3 Basic Alarms ............................................................................................................ 49
7.3 Positioning Data (Custom Extension)................................................................................. 50
7.3.1 Location Data Status (0x2002) ................................................................................. 50
7.3.2 Terminal Status Information Reporting (0x2003) .................................................... 50
7.3.3 Terminal Status Information Reporting (0x2005) .................................................... 51
7.3.4 Peripheral Raw Data Pass-Through (0x2007) .......................................................... 52
7.3.5 Peripheral Information (0x2006) .............................................................................. 53
7.4 EB Extended Alarm (Custom Timezone Information) ....................................................... 54
- Image/Video Upload Protocol (Image Server) ............................................................................ 55
8.1 General ................................................................................................................................ 55
8.2 Agreement details ............................................................................................................... 56
- Appendix II: Uplink and Downlink Data Examples .................................................................... 59


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved. 1


- Terms and Abbreviations
Terms Abbreviation/Definition
Abnormal data
communication link
The radio communication link is interrupted (such as poor signal) or temporarily
suspended (such as during a call or device offline).
Location reporting
strategy
Timed reporting
Location reporting
program
Rules for determining the interval of periodic reporting based on relevant
conditions.
Additional points
report while turning
The terminal sends location information when it detects the vehicle is turning. The
sampling frequency is no less than 1 Hz, the vehicle's heading change rate is at
least 30°/s, and this condition lasts for at least 2 seconds.



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   2

## 2. Relevant Description
2.1 Notes on Versions
This document supports JT/T 808-2019 (v2019), JT/T 808-2011 (v2011), and JT/T 1078-
- The primary focus is on v2019, while compatibility with v2011 is maintained, and JT/T
1078-2016 serves as a supplementary.
The main differences among v2011 and v2019 mentioned in this document lie in the message
header structure, terminal registration protocol, authentication protocol, text
information delivery (0x8300), and packet segment retransmission request. Chapters 4
through 6 define and describe the message body. If the content is the same in both v2011 and
v2019 protocols, it will be presented in a single table. Each table title will indicate its location
in the corresponding protocol, so special attention should be paid to these distinctions.
## 2.2 Protocol Extension
Based on the standard protocol framework issued by the Ministry of Transport (PRC) and the
functional needs of current products, new functional protocols have been added to enable
interaction between the platform and the terminal.
2.3 Notes on Padding
Since the v2011 and v2019 protocols use different padding methods (zero padding at the
front or end), this document standardizes it by using end-padding for all fields except for
phone numbers in the message header, where front-padding is retained.
The known fields requiring padding include:
(1) In the message headers of both v2011 and v2019, phone numbers are padded with zeros
at the front, and this remains unchanged in this document.
(2) In terminal registration (0x0100), the terminal model and terminal ID in v2011 are end-
paded, while it is front-padded in v2019. Since the original text does not specify the
padding method for terminal ID, both versions will use end-padding for the terminal ID in
this document.
(3) In v2019, the software version number in terminal authentication uses end-padding, and
this remains unchanged in this document.



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   3

## 3. Protocol Format
## 3.1 Data Type
## Table 3-1 Data Types
Data Type Description/Requirements
BYTE Unsigned single-byte integer (8 bits)
WORD Unsigned double-byte integer (byte, 16 bits)
DWORD Quad-byte unsigned integer (32 bits)
BYTE[n] n bytes of data
BCD[n] 8421 code, n bytes
BYTE[21] GBK encoding. Empty if no data is present.

## 3.2 Message Structure
## 3.2.1 General Structure
Each message is consisted of IDs, a message header, a message body, and an error check
code. The message structure is shown as follows:
## Table 3-2 Message Structure
Flag (0x7E) Message Header Message Body Error Check Code Flag (0x7E)


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   4

JT/T 808-2011 Message Structure
Flag (0x7E)Flag (0x7E)
0x7E ➡ 0x7D 0x020x7E ➡ 0x7D 0x02
0x7D ➡ 0x7D 0x010x7D ➡ 0x7D 0x01
Flag (0x7E)Flag (0x7E)Flag (0x7E)Flag (0x7E)Flag (0x7E)
## BYTE
From the message
header onward, XOR
with the next byte until
the byte before the
checksum, occupying
one byte.
## Message
## ID
## Message Body
## Attributes
## Terminal
## Phone
## Number
## Message
## Sequence
## Number
## Message Envelope
## Items
## Byte
## Position
## 0–12–34–910–11
## WORDWORDBCD
## Total Packet Count
## Packet Sequence
## Number
## Byte Position0–12–3
## WORDWORD
ReservedSegmentation
## Data
## Encryption
## Method
## Message Body
## Length
## Byte
## Position
## 14–151310–120–9
## Custom Content
Refer to specific
communication
functions for
details.
The message structure specified in the Ministry's standard protocol is as follows:


## 3.2.2 Flag
The flag should be represented by 0x7E. If either 0x7E or 0x7D appears in the checksum,
message header, or message body, escape processing must be applied.
Escape rules are defined as follows:
 First escape 0x7D to a fixed two-byte data: 0x7D 0x01; then escape 0x7E to a fixed two-
byte data: 0x7D 0x02.


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   5

The escape process is as follows:
 When sending a message: Encapsulate the message first, then calculate and fill in the error
check code, and finally perform escaping.
 When receiving a message: Perform escape restoration, then verify the checksum, and
finally parse the message.
Example: The original packet 0x30 0x7e 0x08 0x7d 0x55 will be encapsulated as 0x7e 0x30
0x7d 0x02 0x08 0x7d 0x01 0x55 0x7e after escaping.
## 3.2.3 Message Header
## Table 3-3 Message Header Structure
## Start Byte
## Field
## Data Type
Description/Requirements
v2011 v2019 v2011 v2019
0 0 Message ID WORD —
## 2 2
Message body
attributes
WORD See the table below for the structure.
## — 4
## Protocol
version number
(no such field
in v2011)
## BYTE
Indicate the protocol version, which is 1 for the
initial version and increments with each critical
revision.
4 5 Device IMEI BYTE[6] BYTE[10]
Convert the hex to decimal to get the first 14
digits of the device IMEI. For example:
Device IMEI (hex): 4EB6FB4AD5FB
Decimal equivalent: 86547807000059
Get the check digit "3" by Luhn algorithm
Then the IMEI is "865478070000593"
If the length of the number doesn't meet
requirements, 0s are prepended; for Hong
Kong, Macau, and Taiwan, the padding is
based on their area codes.
## 10 15
## Message
sequence
number
## WORD
Send in order, starting from 0 and adding
cyclically
## 12 17
## Message
encapsulation
item
## —
This field has content if the relevant flag in
message body attributes field confirms
segmentation; otherwise, no such field exists.

Example data: 7E 02 00 00 5F 4E B6 FB 4A D5 FB 00 04 00 00 00 00 00 0C 00 03 01 58 7D
B2 06 CA A2 48 00 3B 00 00 00 00 25 01 16 16 17 45 01 04 00 00 00 02 14 04 00 00 00 01

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   6

30 01 1F 31 01 1B 15 04 00 00 00 02 E8 1E 04 11 10 30 30 30 30 35 39 33 25 01 16 16 17
45 00 00 00 00 20 03 07 01 00 00 00 00 06 42 EB 09 55 54 43 2B 30 38 3A 30 30 AE 7E.
## Conversion:
 Device ID (Hex): 4EB6FB4AD5FB
 Decimal equivalent: 86547807000059
 Then apply the Luhn algorithm to calculate the 15th check digit and get "3".
 Full IMEI (decimal): 865478070000593

Table 3-4 Structure of Message Body Attributes
## BIT 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0
v2011
Reserved for future
use
## Segmen
tation
## Data
encryption
method
Message body length
v2019
## Reserve
d for
future
use
## Version
identifier
## Segmen
tation
## Data
encryption
method
Message body length
NOTE: The version identifier's value is fixed as 1.

Notes on data encryption method:
- Bits 10 to 12 are data encryption flag bits;
- If the three bits are 0, the message body is unencrypted (default);
- If bit 10 is 1, the message body is encrypted using RSA;
- The remaining bits are reserved.
Packet segmentation:
If bit 13 in the message body attributes is 1, the message body is long and requires
segmentation prior to transmission. The segmentation details are determined by the message
encapsulation item. If bit 13 is 0, there is no message encapsulation item field in the header.

The content of the message encapsulation item is shown in the table below:
## Table 3-5 Message Encapsulation Item Content
Start Byte Field Data Type Description/Requirements
0 Total packet count WORD Total number of packets after segmentation
2 Packet sequence number WORD Start from 1.


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   7

## 3.2.4 Message Body
Different message bodies correspond to specific message IDs; their content and formats can be
referred to in Chapters 4 to 6.
## 3.2.5 Error Check Code
The  checksum  is  calculated  starting  from  the very  first  byte  of  the  message  header.  XOR
operations are performed with each subsequent byte until the last byte of the message body.
The result of these operations is a one-byte checksum.

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   8

- General Protocols (Message Body)
The protocols are classified and described by functionality. Unless otherwise specified, TCP is
used by default.
## 4.1 Basic Protocols
## 4.1.1 General Terminal Response (0x0001)
Table 4-1 Format of General Terminal Response Message Body
Start Byte Field Data Type Description/Requirements
## 0
Reply sequence
number
## WORD
Correspond to the sequence number of the platform-
initiated message.
2 Response ID WORD Correspond to the ID of the platform-initiated message.
4 Result BYTE
0: Success/Confirmation; 1: Failure; 2: Message error; 3:
Not supported.

## 4.1.2 General Platform Response (0x8001)
Table 4-2 Format of General Platform Response Message Body
Start Byte Field Data Type Description/Requirements
## 0
## Reply
sequence
number
## WORD
Correspond to the sequence number of the terminal-
initiated message.
2 Response ID WORD Correspond to the ID of the terminal-initiated message.
4 Result BYTE
0: Success/Confirmation; 1: Failure; 2: Message error; 3:
Not supported; 4: Alarm processing confirmation.

## 4.1.3 Terminal Heartbeat (0x0002)
The heartbeat message body is empty.


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   9

## 4.1.4 Terminal Registration (0x0100 / 0x8100)
The terminal must first register. Upon registration success, the terminal obtains and saves the
authentication code, which will be needed for future authentication. Before terminal removal
or replacement, the terminal must be deregistered to unbind from the vehicle.
If SMS is used send terminal registration and deregistration messages, the platform should
reply to the registration message with an SMS response and to the deregistration message
with a general response (0x8001) via SMS.
➢ Terminal registration message ID: 0x0100
See the table below for the registration message body format.
## Table 4-3 Registration Message Body Format
## Start Byte
## Field
Data Type Description/Requirements
v2011 v2019 v2011 v2019 v2011 v2019
0 Province ID WORD
Indicate the province where the vehicle
installed with the terminal is. The platform
will assign a default value if this field is set to
- The ID is the first two digits of the
administrative code specified in GB/T 2260
Codes for the administrative divisions of the
People's Republic of China.
## 2
City/County
## ID
## WORD
Indicate the city and county where the vehicle
installed with the terminal is. The platform
will assign a default value if this field is set to
- The ID is the last four digits of the
administrative code specified in GB/T 2260
Codes for the administrative divisions of the
People's Republic of China.
## 4
## Manufacture
r ID
## BYTE[5] BYTE[11]
Consist of the administrative code (of the
manufacturer's location) and manufacturer ID.
## 9 15
## Device
model
## BYTE[20] BYTE[30]
Specify by the
manufacture and
occupy 20 bytes,
where "0x00" are
appended if the
length doesn't meet
the requirement.
Specify by the
manufacture and
append with "0x00" if
the length doesn't
meet the requirement.
29 45 Terminal ID BYTE[7] BYTE[30]
Specify by the
manufacture and
occupy 7 bytes,
The terminal ID is
specified by the
manufacturer and

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   10

## Start Byte
## Field
Data Type Description/Requirements
v2011 v2019 v2011 v2019 v2011 v2019
where the ID should
be a combination of
upper-case letters and
digits and "0x00" are
appended if the
length doesn't meet
the requirement.
should be a
combination of
upper-case letters and
digits.
## 36 75
License plate
color
## BYTE
Follow what is specified in JT/T 697.7-2014
Basic data element of transportation
information and set it to 0 for unregistered
vehicles.
## 37 76
License plate
number
## BYTE[21]
Issued by the Traffic Management
Department under Public Security Bureau.
Input the VIN for unregistered vehicles.

## Note:
The Terminal ID is the IMEI of the terminal (for example: 323433313137309).
The Terminal ID in v2011 is 7-byte long (BYTE[7]): 0x32 0x34 0x33 0x31 0x31 0x37 0x30
(discard the last bit).
The Terminal ID in v2019 is 30-byte long (BYTE[30]):
## 0x32 0x34 0x33 0x31 0x31 0x37 0x30 0x90 0x00 0x00
## 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00
0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 (appended with 0s)

➢ Terminal registration response message ID: 0x8100
See the table below for the registration response message body format.
## Table 4-4 Registration Response Message Body Format
Start Byte Field Data Type Description/Requirements
## 0
## Reply
sequence
number
## WORD
Correspond to the sequence number of the terminal
registration message.
2 Result BYTE
0: Success; 1: Vehicle already registered; 2: No such
vehicle in database; 3: Terminal already registered; 4: No
such terminal in database

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   11

Start Byte Field Data Type Description/Requirements
## 3
## Authentication
code
BYTE[21] This field exists only when the registration result is 0.

## 4.1.5 Terminal Deregistration (0x0003)
The terminal parameter query message body is empty.
## 4.1.6 Terminal Authentication (0x0102)
Upon successful connection to the platform, registered terminals must immediately
authenticate. No other messages should be transmitted until authentication is successful.
The authentication process involves the terminal sending an authentication message, to which
the platform replies with a general response message (0x8001).
➢ v2011:
## Table 4-5 Authentication Message Body Format
Start Byte Field Data Type Description/Requirements
## 0
## Authentication
code
## BYTE[21]
The terminal sends this code to the platform upon
reconnection.

➢ v2019
## Table 4-6 Authentication Message Body Format
Start Byte Field Data Type Description/Requirements
0 Authentication code length BYTE —
n
Authentication code
content
BYTE[21] Length of authentication code (n)
n+1 Terminal IMEI BYTE[15] —
n+9 Software version number BYTE[20]
Specify by the manufacturer and append with
0x00 if the length doesn't meet requirements. 'n'
represents the length of the authentication code.



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   12

## 4.1.7 Segment Retransmission Request (0x8003 / 0x0005)
➢ Message ID for server-initiated segment retransmission requests (v2019): 0x8003
➢ Message ID for terminal-initiated segment retransmission requests (v2019): 0x0005
The format of the terminal-initiated segment retransmission request message body is the same
as that of the server-initiated segment retransmission request message body, as shown in the
table below.
NOTE: The v2011 has only 0x8003.
Table 4-7 Format of Segment Retransmission Request Message Body
## Start Byte
## Field
## Data Type
Description/Requirements
v2011
v201
## 9
v2011 v2019
## 0
## Original
message
sequence
number
## WORD
Correspond to the sequence number of the first
segment to be retransmitted.
## 4 2
## Retransmissio
n segment
count
BYTE WORD n
## 5 4
## Retransmissio
n segment ID
list
BYTE[2*n]
Ordered by the retransmission segment
sequence number, such as Segment ID1,
Segment ID2, ..., Segment IDn. "n" is the total
number of retransmission segments.
NOTE: The response to this message should be to retransmit the segment(s) in the retransmission segment
ID list exactly the same as the original segment message.

## 4.2 Terminal Management Protocols
Parameters are typically used for configuring various functions of a terminal. Each parameter
has a unique ID and data type, as detailed in the table below. This table applies to protocols
0x8103, 0x8106, and 0x0104.
Table 4-8 Definitions and Descriptions of Parameter IDs
Parameter ID Data Type Description/Requirements
0x0001 DWORD Interval to send heartbeat packets (unit: second)
0x0010 BYTE[21] Primary server access point name (APN) for wireless communication.

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   13

Parameter ID Data Type Description/Requirements
If the network type is CDMA, this will be the PPP dial-up number.
0x0011 BYTE[21] Primary server dial-up username for wireless communication
0x0012 BYTE[21] Primary server dial-up password for wireless communication
0x0013 BYTE[21]
Primary server address - IP or domain name, where the host and port
number are separated by a colon (:) and multiple servers are separated
by semicolons (;).
0x0018 DWORD TCP port
0x0020 DWORD
Location reporting strategy (0: Timed reporting; 1: Distance-based
reporting; 2: both)
0x0027 DWORD
Reporting interval in sleep mode, in seconds (s). The value must be
greater than 0.
0x0029 DWORD
Default reporting time interval in seconds (s). The value must be
greater than 0.
0x002C DWORD
Default reporting distance in meters (m). The value must be greater
than 0.
0x0030 DWORD
Turning angle (degrees) to trigger additional location data upload. The
value must be smaller than 180.
0x0031 WORD Geofence radius (unauthorized movement threshold) in meters (m)
0x0041 BYTE[21] Reset phone number, used to call the terminal to reset itself.
0x0042 BYTE[21]
Factory reset phone number, used to call the terminal to restore to
factory settings.
0x0045 DWORD
Terminal call answering policy (0: Answer automatically; 1: Answer
automatically when ACC ON and manually when ACC OFF)
0x0048 BYTE[21] Listen-in phone number
0x0050 DWORD
Alarm mask word, corresponding to the alarm flag in the location
reporting message. If the corresponding bit is 1, the corresponding
alarm will be masked.
0x0051 DWORD
Switch to enable or disable SMS alarms, corresponding to the alarm
flag in the location reporting message. If the corresponding bit is 1, the
corresponding alarm will be sent via SMS.
0x0052 DWORD
Switch to enable or disable camera recording for alarms, corresponding
to the alarm flag in the location reporting message. If the corresponding
bit is 1, the camera will be activated to record the corresponding alarm.
0x0053 DWORD
Alarm photo save flag, corresponding to the alarm flag in the location
reporting message. If the corresponding bit is 1, the photo(s) taken
during the corresponding alarm will be saved or upload immediately.
0x0055 (0xF008) DWORD Maximum speed (km/h)

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   14

Parameter ID Data Type Description/Requirements
0x0056 DWORD Overspeed duration, in seconds (s)
0x0065 DWORD Distance-based photo control
0x0080 DWORD Vehicle odometer reading (unit: 0/10km)
0x0081 WORD Province ID where the vehicle is located
0x0082 WORD City ID where the vehicle is located
0x0090 BYTE
GNSS setting, defined as follows:
bit0 = 0 (Disable GPS) / 1 (Enable GPS)
bit1 = 0 (Disable BDS) / 1 (Enable BDS)
bit2 = 0 (Disable GLONASS) / 1 (Enable GLONASS)
bit3 = 0 (Disable Galileo) / 1 (Enable Galileo)
0x0075 Array Audio/video parameter settings
0x0076 Array Audio/video channel list
0x0077 Array Individual video channel parameter settings
0x0079 Array Special alarm video recording settings
0x007A DWORD Video-related alarm mask word, see Chapter 7 for details.

## 4.2.1 Terminal Parameter Setup (0x8103)
The platform sets the parameters of a terminal by sending a message carrying these
parameters, and the terminal replies with a general response message (0x0001). The platform
can query terminal parameters by sending a query message, and the terminal replies with the
corresponding parameter settings. Terminals should support specific parameters depending
on the network type.
Table 4-9 Format of Parameter Setup Request Message Body
Start Byte Field Data Type Description/Requirements
0 Total number of parameters BYTE Number of parameter items (n)
## 1
Parameter item list

## Parameter
item 1
Parameter ID DWORD
See Table 4-8 Definitions and
Descriptions of Parameter IDs for
details.

## Parameter
length
BYTE Parameter length

## Parameter
value
## -
If it is a multi-value parameter,
multiple parameter items with the
same ID are used in the message,
such as the dispatch center number.
## Parameter ... ... ...

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   15

Start Byte Field Data Type Description/Requirements
item 2

## Parameter
item n
## ... ... ...

For example:
Set the location reporting strategy to 0 (timed-reporting), location reporting program to 0
(based on ACC status), reporting interval when ACC ON to 10s, reporting interval during
SOS alarm to 60s, and reporting interval when ACC OFF (sleep) to 200s, then the message is
as follows:
[v2011] 7E 81 03 00 37 01 88 12 34 56 78 E8 BE 06 00 00 00 20 04 00 00 00 00 00 00 00 21
04 00 00 00 00 00 00 00 29 04 00 00 00 0A 00 00 00 28 04 00 00 00 3C 00 00 00 27 04 00
## 00 00 C8 00 00 00 30 04 00 00 00 28 A5 7E
## 4.2.2 Terminal Parameter Query (0x8104)
The message body is empty.
## 4.2.3 Specified Terminal Parameter Query (0x8106)
The format of the specified terminal parameter query message body is shown below. The
terminal replies with 0x0104.
Table 4-10 Format of Specified Terminal Parameter Query Message Body
Start Byte Field Data Type Description/Requirements
## 0
Total number of
parameters
## BYTE —
1 Parameter ID list BYTE[4*n]
Ordered by parameter sequence, such as "Parameter
ID1 Parameter ID2 ... Parameter IDn", where "n" is the
total number of parameters.

## 4.2.4 Terminal Parameter Query Response (0x0104)
Table 4-11 Format of Parameter Query Response Message Body
## Start
## Byte
## Field
## Data
## Type
Description/Requirements
0 Reply sequence number WORD Correspond to the sequence number of the

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   16

## Start
## Byte
## Field
## Data
## Type
Description/Requirements
terminal parameter query message.
2 Number of parameters in the reply BYTE n
## 3
## Parameter
item list
## Parameter
item 1
## Parameter
## ID
## DWORD
See Table 4-8 Definitions and
Descriptions of Parameter IDs for details.

## Parameter
length
BYTE Parameter length

## Parameter
value
## —
See Table 4-8 Definitions and
Descriptions of Parameter IDs for details.

## Parameter
item 2
## ... ... ...

## Parameter
item n
## ... ... ...

## Example (v2011):
Platform sends:
## 7E 81 04 00 00 01 88 12 34 56 78 00 B4 B0 7E
Terminal replies:
7E 01 04 00 5F 01 88 12 34 56 78 00 0B 00 B4 09 00 00 00 01 04 00 00 00 78 00 00 00 10
05 63 6D 6E 65 74 00 00 00 13 0E 31 32 30 2E 32 33 37 2E 38 37 2E 31 39 34 00 00 00 18
04 00 00 EA 68 00 00 00 20 04 00 00 00 00 00 00 00 27 04 00 00 00 B4 00 00 00 29 04 00
## 00 00 0A 00 00 00 2C 04 00 00 01 2C 00 00 00 30 04 00 00 00 0F 45 7E
## 4.2.5 Terminal Control (0x8105)
[Application] Reset the terminal or restore the terminal to factory settings.
See the table below for the terminal control message body format.
## Table 4-12 Control Message Body Format
Start Byte Field Data Type Description/Requirements
## 0
## Command
## Word
BYTE See Table 4-13 Command Word Details for details.
## 1
## Command
parameter
## BYTE[21]
The format of the command parameters is described
below. Each field is separated by a semicolon (";"). Each
STRING field is encoded using GBK before being
assembled into the message.

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   17

## Table 4-13 Command Word Details
## Command
## Word
## Command
parameter
Description/Requirements
## 2 BYTE[21]
Control the terminal to connect to a specified server. Parameters are separated
by semicolons (;). The control command is as follows: "Connection control (0
to switch to the designated supervision platform server, 1 to switch back to
the default monitoring platform server); Supervision platform authentication
code; Dial point name; Dial-up username; Dial-up password; Address; TCP
port; UDP port; Connection time limit to the specified server." If a parameter
has no value, leave it empty. If the connection control value is 1, no
subsequent parameters are required.
4 None Reset the terminal
5 None Restore the terminal to default settings.

4.2.6 TTS Message Delivery (0x8300)
➢ v2011:
Table 4-14 Format of TTS Message Body
Start Byte Field Data Type Description/Requirements
0 Flag BYTE 1: Emergency
1 Text message BYTE[21] A maximum length of 1024 bytes encoded in GBK

Example (v2011): Send the command timer,30,180#
7E 83 00 00 0E 01 88 12 34 56 78 E8 BE 01 74 69 6D 65 72 2C 33 30 2C 31 38 30 23 25 7E

➢ v2019:
Table 4-15 Format of TTS Message Body
Start Byte Field Data Type Description/Requirements
0 Flag BYTE See the table below for details.
1 Text type BYTE 1: Notification; 2: Service
2 Text message BYTE[21]
A maximum length of 1024 bytes encoded
in GBK


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   18

Table 4-16 Connotations of Flags in TTS Message
## Bit Flag
## 0–1 01: Service; 10: Emergency; 11: Notification
2 1: Display on terminal screen
3 1: Read out by terminal (TTS)
## 4 —
5 0: Central navigation information, 1: CAN fault code information
## 6–7 Reserved

4.2.7 Pass-Through Protocols (0x8900 / 0x0900)
Downlink transparent message ID: 0x8900
The format of the downlink transparent message body is shown in the table below:
Table 4-17 Format of Downlink Transparent Message Body
Start Byte Field Data Type Description/Requirements
## 0
## Transparent
message type
## BYTE
See Table 4-19 Definitions of Transparent Message Types
for details.
## 1
## Transparent
message content
## —

Uplink transparent message ID: 0x0900
The format of the uplink transparent message body is shown in the table below:
Table 4-18 Format of Uplink Transparent Message Body
Start Byte Field Data Type Description/Requirements
## 0
Transparent message
type
## BYTE
See Table 4-19 Definitions of Transparent Message
Types for details.
l
Transparent message
content
## — —

Table 4-19 Definitions of Transparent Message Types
Transparent message type Definition Description/Requirements
Detailed GNSS location data 0x00 Detailed GNSS location data

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   19

Transparent message type Definition Description/Requirements
Road transport certificate (IC
card) information
0x0B
The message is 64-byte long for uplink transmission and
24-byte long for downlink transmission. The timeout length
of this transparent message is 30s and no retransmission
will be performed after timeout.
Serial port 1 transparent
transmission
0x41 Transparent message sent over serial port 1
Serial port 2 transparent
transmission
0x42 Transparent message sent over serial port 2
User-defined message
0xF0–
0xFF
0xF0: Online command
0xF1: jimiiothub raw content
0xF2: Terminal parameters, see the table below for details.

## Table 4-20 Transparent Online Command
Start Byte Field Data Type Description/Requirements
0 Transparent message type 0xF0
1 Transparent message content (n) n
Example formats:
## VERSION#
## COMVER#
## SOS,A,X1,X2,X3#
NOTE: When the platform sends transparent commands, it uses the message sequence
number to establish a one-to-one correspondence with the terminal's response. The
terminal's reply will use the same sequence number as the platform's original command.


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   20

## 4.3 Location Information
## 4.3.1 Location Reporting (0x0200)
The terminal should immediately upload a location message including the alarm status to the
platform when an alarm is triggered.
The location reporting message body consists of the basic and supplementary location
information, as shown in the table below.
Table 4-21 Format of Location Reporting Message Body
## /
## Start
## Byte
Field Data Type Description/Requirements
Supplementary information item list

0 Alarm flag DWORD
See Table 4-22 Definitions of Alarm
Flags for details.
4 Status DWORD
See Table 4-23 Definitions of Status
Bits for details.
8 Latitude DWORD
Longitude in degrees multiplied by
## 10
## 6
, accurate to one millionth of a
degree
12 Longitude DWORD
Longitude in degrees multiplied by
## 10
## 6
, accurate to one millionth of a
degree
16 Elevation WORD Altitude in meters (m)
18 Speed WORD 1/10 km/h
20 Heading WORD
0–359 (where 0 is due north,
measured clockwise)
21 Date/time BCD[6]
YY-MM-DD-hh-mm-ss (GMT time,
which prevails in this document)

## Supplementary
information item
## 1
## Supplementary
information ID
## BYTE 1-255
## Supplementary
information
length
BYTE x
## Supplementary
information
BYTE[x] See 7 for details.

## Supplementary
information item
## 2
## ... ... ...
## Supplementary ... ... ...

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   21

## /
## Start
## Byte
Field Data Type Description/Requirements
information item
n

Table 4-22 Definitions of Alarm Flags
## Bit Definition Processing Remarks
## 0
1: Emergency alert triggered upon emergency button
activation
Zero upon receiving a response.
1 1: Overspeed alert Flag persists until condition cleared.
2 1: Fatigue driving Flag persists until condition cleared.
3 1: Pre-alert Zero upon receiving a response.
4 1: GNSS module failure Flag persists until condition cleared.
5 1: GNSS antenna unconnected or cut Flag persists until condition cleared.
6 1: GNSS antenna shorted Flag persists until condition cleared.
7 1: Main power supply undervoltage Flag persists until condition cleared.
8 1: Main power supply failure Flag persists until condition cleared.
9 1: LCD or monitor failure Flag persists until condition cleared.
10 1: TTS module failure Flag persists until condition cleared.
11 1: Camera failure Flag persists until condition cleared.
## 12–
## 17
## Reserved
18 1: Excessive accumulated daily driving time Flag persists until condition cleared.
19 1: Parking overtime Flag persists until condition cleared.
20 1: Geofence entry/exit alert Zero upon receiving a response.
21 1: Route entry/exit alert Zero upon receiving a response.
22 1: Insufficient/excessive driving time in road segment Zero upon receiving a response.
23 1: Deviate from route Flag persists until condition cleared.
24 1: VSS fault Flag persists until condition cleared.
25 1: Fuel level exception Flag persists until condition cleared.
26 1: Vehicle being stolen (via anti-theft device) Flag persists until condition cleared.
27 1: Unauthorized ignition on Zero upon receiving a response.
28 1: Unauthorized movement Zero upon receiving a response.
## 29–
## 31
## Reserved

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   22

Table 4-23 Definitions of Status Bits
## Bit Status
0 0: ACC off; 1: ACC on
1 0: No position fix; 1: Position fix acquired
2 0: South latitude; 1: North latitude
3 0: East longitude; 1: West longitude
## 4 0: Operational; 1: Non-operational
5 0: Coordinates unencrypted; 1: Coordinates encrypted
## 6–9 Reserved
10 0: Fuel system normal; 1: Fuel system disconnected
11 0: Electrical system normal; 1: Electrical system disconnected
12 0: Door unlocked; 1: Door locked
## 13–31 Reserved

By default, supplementary information IDs 0x01, 0x30, and 0x31 are included in the location
message. Other supplementary information is only included when required by specific
functionalities. For example, if no geofence alarm is triggered, there's no need to include data
with the supplementary information ID 0x12. When the ACC is ON, the data with the
supplementary information ID 0x2A is unnecessary as well.
(v2011) Example: The terminal sends: 7E 02 00 00 26 01 88 12 34 56 78 00 05 00 00 00 00
00 0C 00 03 01 58 7F FE 06 CA 3B 26 00 04 00 00 00 00 17 03 07 10 51 01 2A 02 00 00 30
## 01 1A 31 01 15 D7 7E
The platform replies: 7E 80 01 00 05 01 88 12 34 56 78 00 02 00 05 02 00 00 00 7E


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   23

## 4.3.2 Location Query (0x8201)
The location query message body is empty.
(v2011) Example: The platform sends: 7E 82 01 00 00 01 88 12 34 56 78 E8 BC 56 7E
The terminal replies: 7E 02 00 00 26 01 88 12 34 56 78 00 10 Terminal replies: 00 00 00 00
00 0C 00 03 01 58 7F FE 06 CA 3B 26 00 04 00 00 00 00 17 03 07 11 13 01 2A 02 00 00 30
## 01 1A 31 01 13 F5 7E
## 4.3.3 Location Query Response (0x0201)
Table 4-24 Format of Location Query Response Message Body
Start Byte Field Data Type Description/Requirements
0 Reply sequence number WORD
Correspond to the sequence number of the
location query message.
2 Location reporting —
## See Table 7-1 Location Reporting Message
Structure for details.

## 4.3.4 Batch Location Data Upload (0x0704)
The format of the batch location data upload message is shown in the table below.
Table 4-25 Format of Batch Location Data Upload Message
## Start Byte Field Data Type Remarks
## 0
Number of data
items
## WORD
The number of location reporting data items n, which must
be greater than zero.
## 1
Location data
type
## BYTE
0: Regular location data; 2: Buffered location data
(generated in dead zones)
## 2
## Location
reporting data
item 1
## —
## Start
## Byte
## Field Data Type Remarks
## 0
## Location
reporting
data body
length
## WORD
The length of the
location reporting
data body is m.
## 2
## Location
reporting
data body
BYTE[n]
See 4.3.1 for the
definition. n is the
length of the
location reporting

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   24

## Start Byte Field Data Type Remarks
data body.

## Location
reporting data
item 2
## — ... ... ... ...

## Location
reporting data
item n
## — ... ... ... ...

## 4.4 Vehicle Control Protocols
The platform sends a vehicle control message to request the terminal to perform specified
operations on the vehicle. After receiving the message, the terminal should immediately reply
with a general response message (0x0001). After that, the terminal should perform the
operation, and based on the result send a vehicle control response message.
## 4.5 Vehicle Management Protocols
The platform sends messages to set geofences (circular or rectangular or polygonal) and
routes to confine the operating area(s) and traveling route(s) of the terminal, that is, the
vehicle.
The terminal then determines whether the conditions for triggering alarms are met based on
the attributes of these areas and routes. The alarms include overspeed, geofence entry/exit,
route deviation, and insufficient or excessive driving duration on a specific road segment. The
terminal should include the corresponding location-related supplementary information in the
location reporting message.
The valid range for the geofence or route IDs is 1–0xFFFFFFFF. If the set ID duplicates an
existing geofence or route ID of the same type in the terminal, the data for that ID will be
updated.
The platform can also delete geofences (circular or rectangular or polygonal) or routes in the
terminal using delete messages.
The geofence and route set or delete message requires the terminal to reply with a general
response message (0x0001).



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   25

- JT/T 808 Multimedia-Related Protocols (Message Body)
Table 5-1 Request-Response IDs Mapping Table
Event/Function Request Message Response Message
Trigger event
[Terminal] 0x0800
Multimedia event information upload
[Platform]    0x8001
General platform response
[Terminal] 0x0801
Multimedia data upload
[Platform] 0x8800
Response to multimedia data upload
request
Request to take
photos
[Platform] 0x8801
Immediate capture command
[Terminal] 0x0001
General terminal response
[Terminal] 0x0805
Response to immediate capture
command
Retrieve directory
[Platform] 0x8802
Multimedia data retrieval
[Terminal] 0x0802
Response to multimedia data retrieval
request
Request to save and
upload multimedia
data
[Platform] 0x8803
Stored multimedia data upload
command (based on time)
[Terminal] 0x0001
General terminal response
[Platform] 0x8805
Single stored multimedia data retrieval
and upload command (based on
multimedia data ID)

## 5.1 Multimedia Event Information Upload (0x0800)
The format of the multimedia event information upload message is shown in the table below.
Table 5-2 Format of Multimedia Event Information Upload Message Body
Start Byte Field Data Type Description/Requirements
## 0
Multimedia data
## ID
DWORD Value greater than 0
4 Multimedia type BYTE 0: Photo; 1: Audio;    2: Video
## 5
## Multimedia
format
## BYTE
0: JPEG; 1: TIF; 2: MP3; 3: WAV; 4: WMV; Others are
reserved
6 Event item code BYTE 0: Platform-issued command; 1: Timed action; 2: Burglary

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   26

Start Byte Field Data Type Description/Requirements
alarm; 3: Collision/rollover alarm; 4: Door open snapshot;
5: Door close snapshot; 6: Door status change (open to
close), speed increases from lower than 20 km/h to higher
than 20 km/h; 7: Distance-based snapshot; Others are
reserved
7 Channel ID BYTE —

## 5.2 Multimedia Data Upload (0x0801 / 0x8800)
When the terminal is activated by a specific event to capture or record, it should actively
upload the multimedia event information after the event occurs. This message requires the
platform to reply with a general response message (0x8001).
Note (v2011): The response to this message should be to use 0x0801 to retransmit the
segment(s) in the retransmission segment list exactly the same as in the original segment
message.
➢ Multimedia data upload message ID: 0x0801
The format of the multimedia data upload message body is shown in the table below:
Table 5-3 Format of Multimedia Data Upload Message Body
Start Byte Field Data Type Description/Requirements
0 Multimedia data ID DWORD >0
4 Multimedia type BYTE 0: Photo; 1: Audio;    2: Video
5 Multimedia format BYTE
## 0: JPEG; 1: TIF; 2: MP3; 3: WAV; 4: WMV;
Others are reserved
6 Event item code BYTE
0: Platform-issued command; 1: Timed action; 2:
Burglary alarm; 3: Collision/rollover alarm; Others
are reserved
7 Channel ID BYTE
## 8
Location reporting
(0x0200) message body
BYTE[28] Basic location information in the multimedia data
36 Multimedia data packet



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   27

➢ Multimedia data upload response message ID: 0x8800
The format of the multimedia data upload response message body is shown in the table
below.
Table 5-4 Format of Multimedia Data Upload Response Message Body
Start Byte Field Data Type Description/Requirements
0 Multimedia data ID DWORD
The value should be greater than 0. If the entire data
packet has been received, there is no further fields.
## 4
## Retransmission
segment count
## BYTE
## 5
## Retransmission
segment ID list

The total number of IDs cannot be greater than 125.
No such field means all segments have been
received.

## 5.3 Immediate Capture Command (0x8801 / 0x0805)
The platform sends an immediate capture command message to the terminal, which replies
with a general response message (0x0001). If immediate upload is required, the terminal
immediately uploads the photo or video after taken; otherwise, to save the photo or video.
➢ Immediate capture command message ID: 0x8801
The format of the immediate capture command message body is shown in the table below.
Table 5-5 Format of Immediate Capture Command Message Body
Start Byte Field Data Type Description/Requirements
0 Channel ID BYTE Value greater than 0
1 Capture command WORD
0: Stop capturing; 0xFFF: Record video; Other:
Number of photos to be taken
## 3
Capture interval /
recording duration
## WORD
The unit is second (s). The value "0" means take
photos at the minimum intervals or always keep
recording.
5 Save flag BYTE
## 1: Save;
0: Upload now
6 Resolution BYTE
0x00: Lowest resolution;
0x01: 320 x 240;
0x02: 640 x 480;
0x03: 800 x 600;
0x04: 1024 x 768;
0x05: 176 x 144 (Qcif);

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   28

Start Byte Field Data Type Description/Requirements
0x06: 352 x 288 (Gif);
0x07: 704 x 288 (Half D1);
0x08: 704 x 576 (D1);
0xff: Highest resolution
## 7
Photo / video
quality
## BYTE
Range from 1 to 10, where 1 represents the
minimum quality loss and 10 the highest
compression.
8 Brightness BYTE 0-255
9 Contrast BYTE 0–127
10 Saturation BYTE 0–127
11 Hue BYTE 0–255
If the terminal does not support the specified resolution, it should capture at the closest available resolution
and upload the captured image/video.

➢ Immediate capture command response message ID: 0x0805
The format of the immediate capture command response message is shown in the table
below. This message is in response to the immediate capture command 0x8801 delivered by
the supervision platform.
Table 5-6 Format of Immediate Capture Command Response Message Body
Start Byte Field Data Type Description/Requirements
## 0
Reply sequence
number
## WORD
Correspond to the sequence number of the platform-initiated
immediate capture command message (0x8801).
2 Result BYTE
0: Success; 1: Failure; 2: Channel not supported
The following fields are only valid if Result = 0.
3 ID count WORD -
4 ID list BYTE[4*n] n represents the number of captured multimedia items.

The platform sends: 7E 88 01 00 0C 12 02 46 96 05 19 00 05 02 00 01 00 02 01 04 01 80 40
## 40 40 99 7E
The terminal replies: 7E 08 05 00 0D 12 02 46 96 05 19 00 06 00 05 00 00 02 10 00 00 00 20
## 00 00 00 ED 7E


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   29

## 5.4 Multimedia Data Retrieval (0x8802 / 0x0802)
The platform sends a multimedia data retrieval message to obtain the status of stored
multimedia data on the terminal. The terminal must reply with a multimedia data retrieval
response message.
Based on the retrieval result, the platform can send a multimedia data upload message to
request the terminal to upload the specified multimedia data. This message requires a general
terminal response (0x0001).
➢ Multimedia data retrieval message ID: 0x8802.
The format for the multimedia data retrieval message body is shown in the table below. If no
time range is specified, start time and end time are both set to 00-00-00-00-00-00.
Table 5-7 Format of Multimedia Data Retrieval Message Body
Start Byte Field Data Type Description/Requirements
## 0
## Multimedia
type
BYTE 0: Photo; 1: Audio; 2: Video
1 Channel ID BYTE
0 means to retrieve all channels for data of the specified
multimedia type.
## 2
Event item
code
## BYTE
0: Platform-issued command; 1: Timed action; 2: Burglary
alarm; 3: Collision/rollover alarm; Others are reserved.
3 Start time BCD[6] YY-MM-DD-hh-mm-ss
9 End time BCD[6] YY-MM-DD-hh-mm-ss

➢ Multimedia data retrieval response message ID: 0x0802
The format of the multimedia data retrieval response message body is shown in the table
below.
Table 5-8 Format of Multimedia Data Retrieval Response Message Body
Start Byte Field Data Type Description/Requirements
0 Reply sequence number WORD
Correspond to the sequence number of
the multimedia data retrieval message.
## 2
Total number of multimedia data
items
## WORD
Total number of multimedia data items
(n) that meet the search criteria.
## 4
## Retrieval
item 1
Multimedia data ID DWORD Value greater than 0
Multimedia type BYTE 0: Photo; 1: Audio; 2: Video
Channel ID BYTE -
Event item code BYTE 0: Platform-issued command; 1: Timed

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   30

Start Byte Field Data Type Description/Requirements
action; 2: Burglary alarm; 3:
Collision/rollover alarm; Others are
reserved
Location reporting
(0x0200) message
body
## -
Indicate the location reporting message
at the start of the capture or recording.

## Retrieval
item 2
## ...

## Retrieval
item n
## ...

The platform sends: 7E 88 02 00 0F 12 02 46 96 05 19 00 07 00 00 00 00 00 00 00 00 00 00
## 00 00 00 00 00 5E 7E
5.5 Single Stored Multimedia Data Retrieval and Upload (0x8805)
The format of the single stored multimedia data retrieval and upload message body is shown
in the table below.
Table 5-9 Format of Single Stored Multimedia Data Retrieval and Upload Message Body
Start Byte Field Data Type Description/Requirements
0 Multimedia data ID DWORD Value greater than 0
4 Delete flag BYTE 0: Retain; 1: Delete

The platform sends: 7E 88 05 00 05 12 02 46 96 05 19 00 09 00 00 00 10 00 4D 7E

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   31

- JT/T 1078-2016 Protocols (Message Body)
Table 6-1 Request-Response IDs Mapping Table
Event/Function Request Message Response Message
Query audio/video properties
[Platform] 0x9003
Terminal audio/video properties
query
[Terminal] 0x1003
Terminal uploads audio/video
properties
Query resource list
[Platform] 0x9205
Resource list query
[Terminal] 0x0001
General terminal response
[Terminal] 0x1205
Terminal uploads audio/video
resource list
File upload
[Platform]    0x9206
File upload command
[Terminal] 0x0001
General terminal response
[Platform]    0x9207
File upload control
[Terminal] 0x0001
General terminal response
[Terminal] 0x1206
File upload completion
notification
[Platform]    0x8001
General platform response

6.1 Real-Time Audio and Video Transmission Command (0x9101)
Message type: Signaling data message
The platform initiates a request to the terminal for real-time audio/video data, including the
transmission of real-time video, initiation of two-way voice communication, one-way listen-
in, broadcasting audio to all terminals, and specific pass-through, etc. See the table below for
the message body format. Upon receiving this message, the terminal replies with a general
response message (0x0001). It then establishes a link using the corresponding server IP
address and port number and sends the requested audio/video stream according to the
audio/video stream transmission protocol.
Upon receiving a special alarm from the video terminal, the platform should proactively
deliver this command to start real-time audio/video transmission without waiting for a
manual confirmation.
The two-way communication function belongs to the 0x9101 protocol and the data type is 2
(two-way voice communication).


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   32

Table 6-2 Data Format of Real-Time Audio-Video Transmission Request
Start Byte Field Data Type Description/Requirements
0 Server IP address length BYTE Length (n)
1 Server IP address BYTE[21] Real-time video server IP address
## 1+n
Server video channel
listening port (TCP)
WORD TCP port number of the real-time video server
## 3+n
Server video channel
listening port (UDP)
WORD UDP port number of the real-time video server
5+n Logical channel number BYTE 01–1F
6+n Data Type BYTE
0: Audio and video, 1: Video, 2: Two-way voice
communication, 3: Listen-in, 4: Central
broadcast, 5: Transparent transmission
7+n Stream type BYTE 0: Main stream; 1: Sub-stream

6.2 Live Audio-Video Streaming and Data Passthrough
Message type: Stream data message
Real-time audio/video stream transmission follows the RTP protocol framework, utilizing
UDP or TCP as transport protocols. The payload packet format extends the IETF RFC 3550
RTP specification by incorporating additional fields such as message sequence number, SIM
card number, and audio/video channel identifier. The payload structure is defined in the table
below (populated in big-endian byte order).
## Start Byte Field Data Type Description & Requirements
0 Header Identifier DWORD Fixed value: 0x30 0x31 0x63 0x64
4 V 2 BITS Fixed value: 2
P 1 BIT Fixed value: 0
X 1 BIT RTP header extension flag, fixed value: 0
CC 4 BITS Fixed value: 1
## 5 M 1 BIT
Marker bit: Indicates boundary of a complete data
frame
PT 7 BITS Payload type (see the table below for details).
6 Sequence Number WORD
Initialized at 0; increments by 1 per transmitted
RTP packet
8 SIM Card Number BCD[6] Device ID
14 Logical Channel ID BYTE 01–1F
15 Data Type 4 BITS 0000: Video I-frame

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   33

## Start Byte Field Data Type Description & Requirements
## 0001: Video P-frame
## 0010: Video B-frame
0011: Audio frame
0100: Passthrough data

## Subpacket Handling
## Flag
## 4 BITS
0000: Atomic packet (indivisible)
0001: First packet
0010: Last packet
0011: Middle packet
16 Timestamp BYTE[8]
Relative timestamp of current frame (unit: ms).
Omitted for pass-through data (Type 0100)
## 24
## Last Keyframe
## Interval
## WORD
Time interval from previous video I-frame (unit:
ms).
Omitted for non-video frames.
26 Last Frame Interval WORD
Time interval from previous frame (unit: ms).
Omitted for non-video frames.
28 Data Body Length WORD
Length of subsequent data body (excluding from
this data packet)
30 Data Body BYTE[n]
Audio/video or pass-through data.
Maximum length: 950 bytes.

Table 6-3 Definitions of Audio-Video Coding Formats
## Code Name Remarks
## 0 Reserved
## 1 G. 721 Audio
## 2 G. 722 Audio
## 3 G. 723 Audio
## 4 G. 728 Audio
## 5 G. 729 Audio
6 G. 711A Audio
7 G. 711U Audio
## 8 G. 726 Audio
9 G. 729A Audio
10 DVI4_3 Audio
11 DVI4_4 Audio
12 DVI4_8K Audio
13 DVI4_16K Audio

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   34

## Code Name Remarks
14 LPC Audio
15 S16BE_STEREO Audio
16 S16BE_MONO Audio
17 MPEGAUDIO Audio
18 LPCM Audio
19 AAC Audio
20 WMA9STD Audio
21 HEAAC Audio
22 PCM_VOICE Audio
23 PCM_AUDIO Audio
24 AACLC Audio
25 MP3 Audio
26 ADPCMA Audio
27 MP4 AUDIO Audio
28 AMR Audio
## 29-90 Reserved
91 Transparently transmitted System
## 92-97 Reserved Video
## 98 H.264 Video
## 99 H.265 Video
100 AVS Video
101 SVAC Video
## 102-110  Reserved
## 111-127  Custom



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   35

6.3 Real-time Audio and Video Transmission Control (0x9102)
Message type: Signaling data message
The platform sends real-time audio/video transmission control commands to switch the
stream type, pause stream transmission, close transmission channels, etc. See the table below
for the message body data format.
Table 6-4 Data Format of Real-Time Audio-Video Transmission Control Message
Start Byte Field Data Type Description/Requirements
## 0
Logical channel
number
## BYTE 01–1F
1 Control command BYTE
This command is used by the platform to control the
transmission of the real-time audio/video data of the
terminal.
0: Close audio/video transmission;
1: Switch stream (includes pause and resume);
2: Pause the transmission of all streams on this channel;
3: Resume the transmission of streams, maintaining the
same stream type as before;
4: Close two-way voice communication.
## 2
Close audio/video
type
## BYTE
0: Close both audio and video data for this channel;
1: Close only audio, keep video;
2: Close only video, keep audio.
## 3
Switch stream
type
## BYTE
Switch the previously requested stream to the newly
requested stream, with audio remaining the same
stream as before.
The new stream is:
0: Main stream;
## 1: Sub-stream.



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   36

## 6.4 Resource List Query (0x9205)
Message type: Signaling data message
The platform searches for the list of recording files in the terminal based on a combination of
search criteria such as audio/video type, channel number, alarm type, and start/end time. See
the table below for the message body format.
Table 6-5 Data Format of Recording File List Query Message
Start Byte Field Data Type Description/Requirements
## 0
Logical channel
number
BYTE 01–1F, where "0" indicates all channels.
1 Start time BCD[6]
YY-MM-DD-HH-MM-SS, where all 0s indicate no start
time is set.
7 End time BCD[6]
YY-MM-DD-HH-MM-SS, where all 0s indicate no end
time is set.
13 Alarm flag 64 BITS
For bits 0–31, see Table 4-22 Definitions of Alarm
Flags for details;
For bits 32–63, see Chapter 7 for details. All 0s indicate
no alarm type is set.
## 21
## Audio/video
resource type
## BYTE
0: Audio and video, 1: Audio, 2: Video, 3: Audio or
video
22 Stream type BYTE 0: All streams, 1: Main stream, 2: Sub-stream.
23 Memory type BYTE
0: All memories, 1: Primary memory, 2: Backup
memory

Table 6-6 Definitions of Video Alarm Flags
## Bit Definition Processing Remarks
0 Video signal loss alarm Flag persists until condition cleared.
1 Video signal block alarm Flag persists until condition cleared.
2 Memory failure alarm Flag persists until condition cleared.
3 Other video device failure alarm Flag persists until condition cleared.
4 Passenger vehicle overcrowded alarm Flag persists until condition cleared.
5 Abnormal driving behavior alarm Flag persists until condition cleared.
## 6
Alarm about total size of special alarm
videos reaching storage threshold
Zero upon receiving a response.
## 7–31 Reserved


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   37

6.5 Audio and Video Resource List Upload (0x1205)
Message type: Signaling data message
This message is used by the terminal as a response to the platform's resource list query. If the
list is too large and requires to be transmitted as segments, the segmentation will follow what
is defined in Section 3.2. The platform should reply to each individual packet with a general
response message (0x8001). See the table below for the message body format.
Table 6-7 Data Format of Audio-Video Resource List Upload Command Message
Start Byte Field Data Type Description/Requirements
0 Sequence number WORD
Correspond to the sequence number of the
audio/video resource list query command
## 2
Total number of
audio/video resources
## DWORD
The number of audio-video resources meeting the
criteria; set to 0 if there are none.
6 Audio/video resource list  See the table below.

Table 6-8 Format of Terminal-Upload Audio/Video Resource List
Start Byte Field Data Type Description/Requirements
## 0
Logical channel
number
## BYTE 01–1F
1 Start time BCD[6] YY-MM-DD-HH-MM-SS
7 End time BCD[6] YY-MM-DD-HH-MM-SS
13 Alarm flag 64 BITS
For bits 0–31, see Table 4-22 Definitions of Alarm
Flags for details;
For bits 32–63, see Chapter 7 for details.
## 21
Audio/video resource
type
BYTE 0: Audio and video, 1: Audio, 2: Video
22 Stream type BYTE 1: Main stream; 2: Sub-stream
23 Memory type BYTE 1: Primary memory; 2: Backup memory
24 File size DWORD Size in bytes



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   38

6.6 Platform-Initiated Remote Video Playback Request (0x9201)
The platform initiates a request to the terminal for audio/video playback. The terminal should
respond using the 0x1205 message (Audio and Video Resource List Upload) and the video
data transmission must follow the RTP packet format defined in Table 6-4 in Chapter 0. See
the table below for the message body format.
Table 6-9 Data Format of Platform-Initiated Remote Video Playback Request
Start Byte Field Data Type Description/Requirements
0 Server IP address length BYTE Length (n)
1 Server IP address BYTE[21] IP address of the real-time audio-video server
## 1+n
Server audio-video channel
listening port (TCP)
## WORD
TCP port number of the real-time audio-video
server, which is set to "0" when the transmission is
not using TCP.
## 3+n
Server audio-video channel
listening port (UDP)
## WORD
UDP port number of the real-time audio-video
server, which is set to "0" when the transmission is
not using UDP.
5+n Logical channel number BYTE 01–1F
6+n Audio/video type BYTE
0: Audio and video, 1: Audio, 2: Video, 3: Audio
or video
7+n Stream type BYTE
0: Main stream or sub-stream, 1: Main stream, 2:
Sub-stream; Set this field to 0 if this channel only
transmits audio.
8+n Memory type BYTE
0: Primary or backup memory, 1: Primary
memory, 2: Backup memory
9+n Playback mode BYTE
## 0: Normal;
1: Fast forward;
2: Keyframe rewind;
3: Keyframe playback;
4: Single frame upload.
10+n Fast forward/rewind speed BYTE
For playback modes 1 and 2, this field is valid;
otherwise, set it to 0.
## 0: Invalid;
## 1: 1x;
## 2: 2x.
10+n Fast forward/rewind speed BYTE
## 3: 4x;
## 4: 8x;
## 5: 16x.
11+n Start time BCD[6]
YY-MM-DD-HH-MM-SS; This field indicates the
upload time of a single frame when the playback

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   39

Start Byte Field Data Type Description/Requirements
mode is set to 4.
17+n End time BCD[6]
YY-MM-DD-HH-MM-SS; if it is set to 0, the
playback continues indefinitely; this field is
invalid when the playback mode is set to 4.

## 6.7 File Upload Command (0x9206)
Message type: Signaling data message
The platform issues a file upload command to the terminal. After receiving the command, the
terminal responds with a general response message (0x0001) and uploads the file to the
designated path on the target FTP server. See the table below for the message body format.
Table 6-10 Data Format of File Upload Command Message
Start Byte Field Data Type Description/Requirements
0 Server address length BYTE Length (k)
1 Server address BYTE[21] FTP server address
1+k Port WORD FTP server port number
## 3+k
Length of the
username
BYTE Length "l"
4+k User name BYTE[21] User name for the FTP server
4+k+l Password length BYTE Length (m)
5+k+l Password BYTE[21] Password for the FTP server
5+k+l+m File upload path length BYTE Length (n)
6+k+l+m File upload path BYTE[21] File upload path
## 6+k+l+m+n
Logical channel
number
## BYTE 01–1F
7+k+l+m+n Start time BCD[6] YY-MM-DD-HH-MM-SS
13+k+l+m+n End time BCD[6] YY-MM-DD-HH-MM-SS
19+k+l+m+n Alarm flag 64 BITS
For bits 0–31, see Table 4-22 Definitions of
Alarm Flags for details;
For bits 32–63, see Chapter 7 for details. All 0s
indicate no alarm type is set.
## 27+k+l+m+n
Audio/video resource
type
## BYTE
0: Audio and video, 1: Audio, 2: Video, 3: Audio
or video
28+k+l+m+n Stream type BYTE 0: All streams, 1: Main stream, 2: Sub-stream.
29+k+l+m+n Store location BYTE 0: Primary or backup memory, 1: Primary

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   40

Start Byte Field Data Type Description/Requirements
memory, 2: Backup memory
## 30+k+l+m+n
Task execution
condition
## BYTE
Represent by bits:
bit 0: WiFi (1: Downloadable via WiFi);
bit 1: LAN (1: Downloadable via LAN);
bit 2: 3G/4G (1: Downloadable via 3G/4G).

## 6.8 File Upload Completion Notification (0x1206)
Message type: Signaling data message
When all files are uploaded via FTP, the terminal sends this command to notify the platform.
See the table below for the message body format.
Table 6-11 Data Format of File Upload Completion Notification Message
Start Byte Field Data Type Description/Requirements
## 0
Reply sequence
number
## WORD
Correspond to the sequence number of the platform-
initiated file upload command.
2 Result BYTE 0: Success; 1: Failure.

## 6.9 File Upload Control (0x9207)
Message type: Signaling data message
The platform notifies the terminal to pause, resume, or cancel all files in transmission. See the
table below for the message body format.
Table 6-12 Data Format of File Upload Control Message
Start Byte Field Data Type Description/Requirements
## 0
Reply sequence
number
## WORD
Correspond to the sequence number of the platform-
initiated file upload command.
2 Upload control BYTE 0: Pause, 1: Resume, 2: Cancel



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   41

- Appendix I: 0x0200 Supplementary Info IDs and Extension
## Supplementary
Information ID
## Supplementary
## Information Length
Description/Requirements
## 0x01 4
Mileage (based on vehicle odometer reading), DWORD,
unit: 1/10km
## 0x02 2
Fuel level (based on vehicle fuel gauge), WORD, unit: 1/10
## L
## ...... ...... ......
## 0x14 4
Video-related alarm, DWORD, bitwise setting, see the table
below for the definitions of flags.
## 0x15 4
Video signal loss alarm status, DWORD, bitwise setting, bits
0 to 31 correspond to logical channels 1 to 32. If the
respective bit is 1, then video signal loss occurs on that
channel.
## 0x17 2
Memory failure alarm status, WORD, bitwise setting. Bits 0
to 11 correspond to primary memories 1 to 12; while bits 12
to 15 correspond to backup memory equipment 1 to 4. If the
respective bit is 1, then the failure occurs to that memory.
## ...... ...... ......
0x30 1 Radio network signal strength, BYTE
0x31 1 Number of positioning satellites, BYTE
## ...... ...... ......
0x64 X ADAS (Advanced Driver Assistance System)
0x65 X DMS (Driver Monitoring System)
## ...... ...... ......
0xE8 n Custom extension
## ...... ...... ......
0xEB n Timezone extension
0xFF n Manufacturer custom extension

Device alarms are divided into two categories. These defined in the standard Ministry
protocols are standard alarms, which are reported using standard supplementary information
IDs. Other alarms are reported using the extended protocol 0xE8 in 0x0200 message.
Message ID: 0x0200.
The location reporting message body consists of the basic and supplementary location
information, as shown in the table below:

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   42

## Table 7-1 Location Reporting Message Structure
Basic location information Supplementary information item list

## Table 7-2 Supplementary Information Item Format
Field Data Type Description/Requirements
Supplementary information ID BYTE 1–255
Supplementary information length BYTE
Supplementary information  See previous context for the definition.

## 7.1  Standard Alarms
These alarms are already defined in the standard Ministry protocols and are mainly
represented in 0x64 and 0x65.
Table 7-3 Extended Definition Table for Supplementary Information
## Supplementary
Information ID
## Supplementary Information
## Length
Description/Requirements
## 0x64
ADAS alert information, as defined in
## Section 7.1.1.
## 0x65
DMS alert information, as defined in
## Section 7.1.2.

7.1.1 Standard ADAS Alarms
This section primarily references T/JSATL12-2017.
Table 7-4 Data Format of ADAS Alert Message
Start Byte Field Data Type Description/Requirements
0 Alert ID DWORD
Start from 0 and increment based on alert generation time
regardless of alert type.
4 Status flag BYTE
## 0x00: Unavailable
0x01: Start flag
0x02: End flag
This field is applicable only to alerts or events with start and
end flags. For alerts/events without start/end flags, this field

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   43

Start Byte Field Data Type Description/Requirements
should be set to 0x00.
## 5
Alert / event
type
## BYTE
0x01: Forward Collision Warning (FCW)
0x02: Lane Departure Warning (LDW)
0x03: Headway Monitoring and Warning (HMW)
0x04: Pedestrian Collision Warning (PCW);
0x05: Frequent lane change alarm;
0x06: Speed over road-sign-limit;
0x07: Obstacle warning;
0x08–0x0F: User defined;
0x10: Road sign recognition event;
0x11: Active capture event;
0x12–0x1F: User defined.
6 Alert level BYTE
0x01: L1 alert
0x02: L2 alert
## 7
Front vehicle
speed
## BYTE
Unit: km/h; Range: 0–250; This field is valid only when the
alert type is 0x01 or 0x02.
## 8
Distance to
front
vehicle/pedest
rian
## BYTE
Unit: 100ms; Range: 0–100; This field is valid only when
the alert type is 0x01, 0x02, or 0x04.
## 9
Lane departure
type
## BYTE
0x01: Left departure
0x02: Right departure
This field is valid only when the alert type is 0x02.
## 10
## Recognized
road sign type
## BYTE
0x01: Speed limit
0x02: Height limit
0x03: Weight limit
This field is valid only when the alert type is 0x06 or 0x10.
## 11
Road sign
recognition
data
BYTE Data about the recognized road sign
12 Vehicle speed BYTE Unit: km/h; Range: 0–250
13 Elevation WORD Altitude in meters (m)
15 Latitude DWORD
Latitude in degrees multiplied by 10
## 6
, accurate to one
millionth of a degree
19 Longitude DWORD
Longitude in degrees multiplied by 10
## 6
, accurate to one
millionth of a degree
23 Date/Time BCD[6] YY-MM-DD-hh-mm-ss (GTM+8)
29 Vehicle status WORD See Table 7-6 Real-Time Data Format for details.
31 Alert ID BYTE[16] See the table below for details.

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   44

Table 7-5 Alert ID Format
Start Byte Field Data Type Description/Requirements
0 Terminal ID BYTE[7] Consist of upper-case letters and digits.
7 Date/time BCD[6] YY-MM-DD-hh-mm-ss (GMT time)
13 Serial No. BYTE
Sequence number for alarms occurred at the same timestamp,
incrementing from 0.
## 14
## Attachment
count
BYTE Number of attachments for this specific alert
15 Reserved BYTE

Table 7-6 Real-Time Data Format
Start Byte Field Data Type Description/Requirements
## 0
## Vehicle
speed
BYTE Unit: km/h; Range: 0–250
1 Reserved BYTE
2 Mileage DWORD Unit: 0.1km; Range: 0–99999999
6 Reserved BYTE[2]
8 Elevation WORD Altitude in meters (m)
10 Latitude DWORD
Latitude in degrees multiplied by 10
## 6
, accurate to one
millionth of a degree
14 Longitude DWORD
Longitude in degrees multiplied by 10
## 6
, accurate to one
millionth of a degree
18 Date/Time BCD[6] YY-MM-DD-hh-mm-ss (GMT time)
## 24
## Vehicle
status
## WORD
Other vehicle status by bit:
[0] ACC status: 0-OFF, 1-ON
[1] Left turn signal: 0-OFF, 1-ON
[2] Right turn signal: 0-OFF, 1-ON
[3] Wiper status: 0-OFF, 1-ON
[4] Braking status: 0-Not braking, 1-Braking
[5] Card insertion status: 0-No card, 1-Card inserted
## Bits 6–9: Custom
[10] Positioning status: 0-No position fix, 1-Position fix
acquired
## Bits 11–15: Custom

Alert types 0x01, 0x02, 0x03, and 0x04 have already realized in the dashcam.

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   45

7.1.2 Standard DMS Alarms
This section primarily references T/JSATL12-2017 and T/GDRTA 002-2020.
Table 7-7 Data Format of DMS Alert Message
## Start
## Byte
## Field
## Data
## Type
Description/Requirements
0 Alert ID DWORD
Start from 0 and increment based on alert generation time
regardless of alert type.
4 Status flag BYTE
## 0x00: Unavailable
0x01: Start flag
0x02: End flag
This field is applicable only to alerts or events with start and end
flags. For alerts/events without start/end flags, this field should be
set to 0x00.
## 5
Alarm / event
type
## BYTE
0x01: Fatigue driving;
0x02: Phone call;
## 0x03: Smoking;
0x04: Distracted driving (looking down or around);
0x05: Driver abnormality;
0x06: Camera blocked;
## 0x08: Over-driving;
0x0A: Seatbelt unfastened;
0x0B: Sunglasses detected;
0x0C: Hands off steering wheel;
0x0D: Phone use;
0x10: Active capture event;
0x11: Driver change event;
0x12–0x1F: User defined.
6 Alert level BYTE
0x01: L1 alert
0x02: L2 alert
7 Fatigue level BYTE
Range: 0–10 The larger the value, the more fatigue the driver. This
field is valid only when the alert type is 0x01.
8 Reserved BYTE[4] Reserved
## 12
Vehicle speed
threshold
BYTE Unit: km/h; Range: 0–250
13 Elevation WORD Altitude in meters (m)
15 Latitude DWORD
Latitude in degrees multiplied by 10
## 6
, accurate to one millionth of
a degree
19 Longitude DWORD Longitude in degrees multiplied by 10
## 6
, accurate to one millionth

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   46

## Start
## Byte
## Field
## Data
## Type
Description/Requirements
of a degree
23 Date/Time BCD[6] YY-MM-DD-hh-mm-ss (GMT time)
29 Vehicle status WORD See Table 7-6 Real-Time Data Format for details.
31 Alert ID BYTE[16] See Table 7-5 Alert ID Format for details.

Types 0x01, 0x02, 0x03, 0x04, 0x05 (face lost), 0x06 (camera obstructed), and 0x0B
(sunglasses detected) have already realized in the dashcam.
7.2  E8 Extended Alarms (Custom)
In addition to the standard alarms defined in the Ministry's standard protocol, we support
custom alarms using the 0xE8 protocol. The supplementary data format for the 0xE8
extended protocol is shown below:
## Table 7-8 E8 Extended Alarm Data Structure
Field Data Type Description/Requirements
Alarm ID/event ID WORD
0x0000–0x03FF: Video-related events/alarms (classified via
video analysis);
0x0400–0x0BFF: Location-related events/alarms (related to
driving routes or durations);
0x0C00–0x0FFF: Basic information events/alarms.
Alarm/event ID length BYTE
Length of the identifier (0 if no ID; otherwise, it must be 16
bytes).
Alarm/event ID
## Terminal
## ID
BYTE[7] Consist of upper-case letters and digits.
Date/time BCD[6] YY-MM-DD hh-mm-ss (BCD encoded system time)
Serial No. BYTE
Sequence number for alarms occurred at the same
timestamp. It must be unique and it is recommended to
increment from 0 cyclically.
## Attachment
count
BYTE Number of attachments
Reserved BYTE It is 1 byte long and the default value is 0.
Alarm/event supplementary
information length
## BYTE
Length of the supplementary information in bytes (0 if no
supplementary information).
## Alarm/event
supplementary
information
## ID1 WORD
## Content 1
length
## BYTE

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   47

Field Data Type Description/Requirements
## (bytes)
Content 1 BYTE[n]
## ID2 WORD
## Content 2
length
## (bytes)
## BYTE
Content 2 BYTE[n]

Alarm/event IDs range from 0x0000–0x0FFF, which are further divided into three categories:
Table 7-9 Extended Alarm ID Ranges
Alarm Category Alarm ID Range Description
Video alarms 0x0001–0x03FF Camera or algorithm related
Location alarms 0x0400–0x0BFF GNSS, vehicle, or driving behavior related
Basic alarms 0x0C00–0x0FFF SOS button, peripheral, battery, or system related

## 7.2.1 Video Alarms
Alarms supported by the dashcam are listed below:
Table 7-10 Extended Video Alarm IDs
Alarm ID Description
0x0001 Camera failure
0x0002 Camera obstructed
0x0003 Seatbelt unfastened (ANWSB)
0x0004 Seatbelt fastened (AWSB)
0x0005 Face ID failed (AFIF)
0x0006 Face ID succeeded (AFIS)
0x0007 Eyes closed
## 0x0008 Yawning
0x0009 Face alignment failed
0x000A Face lost
0x000B Drinking
0x000C Driver changed

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   48

7.2.2 Location/Driving Alarms
Table 7-11 Extended Location/Driving Alarm IDs
Alarm ID Description
0x0400 Harsh acceleration
0x0401 Harsh braking
0x0402 Sharp cornering
## 0x0403 Overspeed
0x0404 Excessive driving time
0x0405 Driving collision
0x0406 Parking vibration
## 0x0407 Towing
0x0408 Geofence entry
0x0409 Geofence exit
0x040A Left turn alarm
0x040B Right turn alarm
0x040C Door open alarm
0x040D Door close alarm
0x0410 Sleep mode event
0x0411 Working mode event
0x0412 UBI harsh acceleration
0x0413 UBI harsh braking
0x0414 UBI sharp cornering
0x0415 UBI sudden lane change
0x0416 UBI collision
0x0417 UBI rollover
0x0418 UBI abnormal attitude
0x0419 UBI abnormal Euler

Example message for alarms 0x0412 and 0x0410:
7e 02 00 00 a0 4e b6 fb 4a d6 06 02 49 00 00 08 00 00 4c 00 03 01 58 9f 53 06 ca 4e 41 00
00 01 1a 01 23 24 09 03 15 30 32 01 04 00 00 00 00 25 04 00 00 00 00 30 01 1f 31 01 1f eb
09 55 54 43 2b 30 38 3a 30 30 14 04 00 00 00 01 15 04 00 00 00 04 65 2f 00 00 00 77 00 ff
02 00 00 00 00 00 1c 00 00 01 58 9f 53 06 ca 4e 41 24 09 03 15 30 32 04 00 00 00 00 00 00
00 00 24 09 03 15 30 32 77 02 00 e8 28 04 12 10 00 00 00 00 00 00 00 24 09 03 15 30 29 76
06 00 00 00 04 10 00 00 00 00 00 00 00 24 09 03 15 30 32 77 06 00 00 ca 7e

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   49

## 7.2.3 Basic Alarms
Table 7-12 Extended Basic Alarm IDs
Alarm ID Description
0x0C01 SOS emergency alert
0x0C02 Low external battery alert
0x0C03 ACC ON
0x0C04 ACC OFF
0x0C05 Theft alarm
0x0C06 DMS calibration error
0x0C07 Identity recognition alert
0x0C08 Door alert
0x0C09 Fuel sensor abnormal alert
0x0C0A Temperature/humidity abnormal alert
0x0C0B Card login alert (DLT)
0x0C0C Card logout alert (DLT)
0x0C0D Unauthorized card alert (DLT)
0x0C0E Power failure alert
0x0C0F Low internal battery alert
0x0C10 Shutdown (due to low battery) alert
0x0C11 Ambient sound alert
0x0C12 Tamper alert
0x0C13 Active offline alert
0x0C14 SD/TF card inserted or mounted
0x0C15 SD/TF card not inserted or removed
0x0C16 SD/TF card write error
0x0C17 Data overage alert
0x0C1A Failed to download the audio file from the specified HTTP URL.



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   50

7.3 Positioning Data (Custom Extension)
The platform requires location data with status and relevant information, including the reason
for reporting. Since this functionality is not defined in standard Ministry protocols, the
following is a Jimi IoT custom extension using the additional 0information ID 0xE8 in
0x0200 message, where a 2-byte identifier is added in the 0xE8 data.
## 7.3.1 Location Data Status (0x2002)
## Field Data Type Description
Location data status packet
## ID
WORD 0x2002 (fixed)
Location data status packet
length
## BYTE
Data upload mode BYTE
0x00: Timed reporting
0x01: Distance-based reporting
0x02: Cornering-based reporting (upload when the device
turns abruptly)
0x03: ACC status change reporting
0x1C: INS position fix reporting
Real-time or buffered data
upload status
## BYTE
0x00: Real-time upload
0x01: Buffered upload (after network recovery)

## 7.3.2 Terminal Status Information Reporting (0x2003)
## Field Data Type Description
Location data status packet
## ID
WORD 0x2003 (fixed)
Location data status packet
length
## BYTE 7
Device charging status BYTE
0x00: Not charging
## 0x01: Charging
Internal battery level BYTE
0x00: Not charging
0x01: Power extremely low (insufficient to initiate calls or
messages)
0x02: Power very low (low battery alert)
0x03: Power low (normal use is possible)
0x04: Power medium
0x05: Power high

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   51

## Field Data Type Description
0x06: Power extremely high
0xFF: Voltage detection unsupported
Battery voltage WORD
Conversion method: Convert hex to decimal, then divide by
## 10.
Take 0x01 0x9F for example, 019F is 415 in decimal and
4.15 after being divided by 100, the resulting value is 4.15V.
Cellular signal strength BYTE
0x00: No signal
0x01: Signal extremely weak
0x02: Signal very weak
0x03: Signal good
0x04: Signal strong
External battery voltage WORD
Conversion method: Convert hex to decimal, then divide by
## 10
Take 0x01 0x9F for example, 019F is 415 in decimal and
4.15 after being divided by 100, the resulting value is 4.15V.

## 7.3.3 Terminal Status Information Reporting (0x2005)
## Field Data Type Description
Terminal status packet ID WORD 0x2005 (fixed)
Terminal status packet length BYTE
If the packet length exceeds 255 bytes, a new ID should be
defined.
## Status
information
ID1 WORD Status information
Length BYTE
Content BYTE[n]
## ID2 WORD
## ....... .......

(1) Device status IDs (0x0000–0x1FFF)
## Status Type
## Status
## ID
## Data
## Type
## Description
## Internal
battery voltage
0x0001 WORD
Convert hex to decimal, then divide by 100 to get the voltage
value. Unit: V. E.g.: 0x019F is 415 in decimal and 4.15 after
being divided by 100.
Daily data
usage
0x0002 DWORD Report once per day and reset every month. Unit: KB

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   52

## Status Type
## Status
## ID
## Data
## Type
## Description
## Internal
battery level
0x0003 BYTE Unit: % (percentage); Range: 0–100
## Charging
status
0x0004 BYTE 0x00: Charging; 0x01: Discharging
SIM card
## ICCID
0x0005 BYTE[10]
Hexadecimal. Integrated Circuit Card Identifiers (ICCIDs) are
typically 19 or 20 digits, with leading zeros for 19-digit ICCIDs.
The format may include:
First 6 digits: carrier code (e.g., 898600 or 898602 for China
## Mobile);
Middle part: area code, card type, etc.;
Last 1-2 digits: checksum.
Network type 0x0006 BYTE
0: No network; 1: Wi-Fi; 2: 2G (GSM); 3: 3G (WCDMA); 4: 4G
## (LTE).
GPS HDOP 0x0007 WORD
The Horizontal Dilution of Precision (HDOP) value from the
NMEA data stream (GNGGA or GNGSA sentence).
To calculate the HDOP value, convert the hexadecimal value to
decimal and divide by 10, e.g., 0x000F=1.5.

(2) Device peripheral status IDs (0x2000–0x1FFF)
Status Type Status ID Data Type Description
External battery
voltage
0x2001 WORD
Convert hex to decimal, then divide by 10 to get the
voltage value. Unit: V.

7.3.4 Peripheral Raw Data Pass-Through (0x2007)
Field Data Type Detailed explanation
Peripheral information reporting
packet ID
WORD 0x2007 (fixed)
Peripheral ID information reporting
packet Length
## BYTE
If the Length is less than 255, it is 1 byte; if the
Length is greater than 255, it is 2 bytes.
Peripheral information
## ID WORD
Length BYTE
Content BYTE[n]
## ID1 WORD
Length 1 BYTE

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   53

Field Data Type Detailed explanation
Content 1 BYTE[n]

## 7.3.5 Peripheral Information (0x2006)
## Field Data Type Description
## Peripheral Information
Packet ID
WORD Fixed value: 0x2006
Packet Length BYTE
The total length of the packet, which must be no greater than
255 bytes; otherwise, a new packet ID is needed.
## Peripheral
## Information
## ID1 WORD
Length BYTE
Content BYTE[n]
## ID2 WORD
## ....... .......

Peripheral IDs (0x0001-0x7FFF)
Category ID Data Type Value Content Description
Fuel Sensor Data 0x0001 BYTE[5]
## [1] Type
## [1] Path
## [2] Value
## [1] Unit
## Type
0x00: Ultrasonic fuel sensor
0x01: Capacitive fuel sensor

## Path
Fuel tank number (default: 0x00)

Value: The voltage value
For type=0: the value is a positive integer
accurate to one decimal place (e.g., 0x00
## 0x06 = 0.6).
For type=1, the value is a positive integer
accurate to two decimal places (e.g., 0x00
## 0x06 = 0.06).

## Unit:
0x01: Height (cm), e.g., 19.47cm.
## 0x02: Percentage
## 0x03: Voltage
## 0x04: Volume (liters)

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   54

Category ID Data Type Value Content Description
## Temperature
## Sensor Data
0x0002 WORD
## [2]
## Temperature
value
The temperature value is converted from
hexadecimal to decimal, accurate to one
decimal place. The unit is 0.1°C.
For example, 0x01 0x1B is 283 in decimal,
resulting in a temperature of 28.3°C.
## Temperature
## Sensor Raw Data
0x0003 BYTE[n]
[n] Serial port
raw data
This is transparent data. For example, 32 38
2E 33 in hexadecimal converts to 28.3°C in
## ASCII.
KD032 CAN Data 0x0004 BYTE[n]
This is the CAN data received via the serial
port. For details, contact your sales to get the
model-specific protocol.

7.4 EB Extended Alarm (Custom Timezone Information)
## Field Data Type Description
Supplementary information ID BYTE 0xEB (fixed)
Timezone string length BYTE
Timezone string STRING
E.g.: UTC+08:00, UTC-08:00, Asia/Shanghai
Note: Daylight Saving Time is supported.



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   55

- Image/Video Upload Protocol (Image Server)
## 8.1 General
UTF-8 encoding default, and the data returned in JSON format
Context-Type: default is application/json charset=utf-8
Timestamp: UTC format, yyyy-MM-dd HH:mm:ss
Return data's attributes
## Parameter Types Required  Description
code string Y Result code
message string N Code description
data Object N Return data result

Transmission protocol
Data transmitted in JSON string format.
HTTP request Headers
## Parameter Types Required Description
## Content - Type String Y
Fixed value
"application/json; charset =UTF-8 "

Description of status code
Common status codes
## Code Description
200 Request succeeded
400 Parameter error
500 System error



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   56

8.2 Agreement details
Upload interface
http://[IP address]/upload
HTTP request method
Support POST submission method. Since the uploaded file is different from other http request
content, you must modify the Content-Type of the Header as follows:
## Parameter Types Required Description
Content-Type String Y multipart/form-data

Request URL parameters
## Parameter Types Required Description
file FilePart Y binary format
filename String Y File name: must be unique, otherwise error happen during storage
timestamp String Y Current time in milliseconds
sign String Y
Encrypted string, used to verify whether the request is legal.
Encryption algorithm: MD5 encryption "filename + timestamp +
secretKey" to be 32 bits lower letter, and then Base64 encryption of
the encrypted string
SecretKey: fixed value, jimidvr@123!443
callbackBody String N Detail as below

callbackBody
## Parameter Require Type Description Remark
businessType YES string
regularPicture
remotePictureOrVideo
eventAttachment
historyVideo
facePicture
faceLibrary
timeLapseVideo
videoClip
facePictureDownload

imei YES string
camera YES int
shootType NO int 1= remote photo

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   57

## Parameter Require Type Description Remark
2= remote video
shootTime NO int Video length Unit is second
alarmTime YES long Unix format Unit is second
eventType NO string Alert ID
lat YES string latitude
lng YES string longitude
mimeType YES string
image/jpeg
image/png
video/mp4
video/h264
video/h265
video/ts
audio/aac
text/plain

localFileName YES string
videoBeginTime NO long Unix format Unit is millisecond
videoEndTime NO long Unix format Unit is millisecond
codeType NO int
1= main streaming
2= sub streaming

timezone NO string
## Example :
"timezone":"GMT+03:0
## 0"
instructionId NO string Unique identifier

Response parameter
## Parameter Types Required Description
code string Y Return result code, 200 success
message string N Status code description information
data String N Return file name

## Example:
## {
## "code":200,
## "data":"img07-1588139792287.png",
"message":"the high success"

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   58

## }

## {
## "code":400,
"message":"File content is empty"
## }


JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   59

- Appendix II: Uplink and Downlink Data Examples
## 1. 0x0100 Terminal Registration
Uplink (0x0100): 7e 01 00 00 25 4e b6 fb 4a d6 28 00 09 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 9a 7e
Downlink (0x8100): 7e 81 00 00 17 4e b6 fb 4a d6 28 00 09 00 09 00 4f 44 59 31 4e 44 63
## 34 4d 44 63 77 4d 44 41 78 4d 44 51 33 59 7e

## 2. 0x0102 Terminal Authentication
Uplink (0x0102): 7e 01 02 00 14 4e b6 fb 4a d6 28 00 0a 4f 44 59 31 4e 44 63 34 4d 44 63
77 4d 44 41 78 4d 44 51 33 d2 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 0a 00 0a 01 02 00 30 7e

## 3. 0x0002 Terminal Heartbeat
Uplink (0x0002): 7e 00 02 00 00 4e b6 fb 4a d6 28 00 0e bb 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 0e 00 0e 00 02 00 31 7e

## 4. 0x0200 Location Reporting
Uplink (0x0200): 7e 02 00 00 4b 4e b6 fb 4a d6 28 00 0b 00 00 08 00 00 0c 00 0d 00 00 00
00 00 00 00 00 00 00 00 00 00 00 25 01 21 17 13 09 01 04 00 00 00 00 25 04 00 00 00 00 30
01 16 31 01 00 eb 09 55 54 43 2b 30 38 3a 30 30 14 04 00 00 00 01 15 04 00 00 00 06 e8 04
## 04 11 00 00 81 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 0b 00 0b 02 00 00 31 7e



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   60

## 5. 0x0704 Batch Location Data Upload
Uplink (0x0704): 7e 07 04 01 95 4e b6 fb 4a d6 28 00 0c 00 06 01 00 39 00 00 00 00 00 0c
00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 23 01 01 08 00 02 01 04 00 00 00 00 25 04
00 00 00 00 30 01 00 31 01 00 eb 09 55 54 43 2b 30 38 3a 30 30 00 39 00 00 00 00 00 0c 00
01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 23 01 01 08 00 03 01 04 00 00 00 00 25 04 00
00 00 00 30 01 00 31 01 00 eb 09 55 54 43 2b 30 38 3a 30 30 00 45 00 00 08 00 00 0c 00 01
00 00 00 00 00 00 00 00 00 00 00 00 00 00 23 01 01 08 00 04 01 04 00 00 00 00 25 04 00 00
00 00 30 01 00 31 01 00 eb 09 55 54 43 2b 30 38 3a 30 30 14 04 00 00 00 01 15 04 00 00 00
06 00 45 00 00 08 00 00 0c 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 23 01 01 08 00
05 01 04 00 00 00 00 25 04 00 00 00 00 30 01 00 31 01 00 eb 09 55 54 43 2b 30 38 3a 30 30
14 04 00 00 00 01 15 04 00 00 00 06 00 45 00 00 08 00 00 0c 00 01 00 00 00 00 00 00 00 00
00 00 00 00 00 00 23 01 01 08 00 13 01 04 00 00 00 00 25 04 00 00 00 00 30 01 00 31 01 00
eb 09 55 54 43 2b 30 38 3a 30 30 14 04 00 00 00 01 15 04 00 00 00 06 00 45 00 00 08 00 00
0c 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 23 01 01 08 00 23 01 04 00 00 00 00 25
04 00 00 00 00 30 01 00 31 01 00 eb 09 55 54 43 2b 30 38 3a 30 30 14 04 00 00 00 01 15 04
## 00 00 00 06 1b 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 0c 00 0c 07 04 00 30 7e

- 0x8900 Data Pass-Through
Downlink (0x8900): 7e 89 00 00 07 4e b6 fb 4a d6 28 dd b2 f0 73 65 72 76
65 72 a3 7e 55 54 43 2b 30 38 3a 30 30 14 04 00 00 00 01 15 04 00
00 00 06 e8 04 04 11 00 00 81 7e
Uplink (0x0001): 7e 00 01 00 05 4e b6 fb 4a d6 28 00 08 dd b2 89 00 00 5d 7e
Uplink (0x0900): 7e 09 00 00 3b 4e b6 fb 4a d6 28 dd b2 f0 73 65 72 76 65 72 2c 69 6f 74
68 75 62 2e 74 72 61 63 6b 73 6f 6c 69 64 70 72 6f 2e 63 6f 6d 2c 32 31 31 32 32 2c 31 31
## 33 2e 31 30 38 2e 36 32 2e 32 30 32 2c 35 32 35 37 35 1e 7e

- 0x9101 Real-time Audio and Video Streaming (CH1)
Downlink (0x9101): 7e 91 01 00 17 4e b6 fb 4a d6 28 f3 d9 0f 31 32 34 2e 32 34 33 2e 31
## 38 34 2e 32 33 37 27 12 00 00 01 00 00 06 7e
Uplink (0x0001): 7e 00 01 00 05 4e b6 fb 4a d6 28 00 16 f3 d9 91 01 00 1f 7e

0x9101 Real-time Audio and Video Streaming (CH2)
Downlink (0x9101): 7e 91 01 00 17 4e b6 fb 4a d6 28 f3 da 0f 31 32 34 2e 32 34 33 2e 31 38
## 34 2e 32 33 37 27 12 00 00 02 00 00 06 7e
Uplink (0x0001): 7e 00 01 00 05 4e b6 fb 4a d6 28 00 17 f3 da 91 01 00 1d 7e

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   61

0x9101 Real-time Audio and Video Streaming (CH3)
Downlink (0x9101): 7e 91 01 00 17 4e b6 fb 4a d6 28 f3 db 0f 31 32 34 2e 32 34 33 2e 31
## 38 34 2e 32 33 37 27 12 00 00 03 00 00 06 7e
Uplink (0x0001): 7e 00 01 00 05 4e b6 fb 4a d6 28 00 18 f3 db 91 01 00 13 7e

## 8. 0x9205 Resource List Query
Downlink (0x9205): 7e 92 05 00 18 4e b6 fb 4a d6 28 f3 f8 01 25 01 23 00 00 00 25 01 23
## 23 59 59 00 00 00 00 00 00 00 00 00 00 00 11 7e
Uplink (0x1205): 7e 12 05 23 84 4e b6 fb 4a d6 28 00 20 00 03 00 01 f3 f8 00 00 00 52 01
25 01 23 00 00 57 25 01 23 00 03 57 00 00 00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01
23 00 03 57 25 01 23 00 06 57 00 00 00 00 00 00 00 00 00 00 00 00 90 00 00 01 25 01 23 00
06 57 25 01 23 00 09 58 00 00 00 00 00 00 00 00 00 00 00 00 90 00 00 01 25 01 23 00 09 58
25 01 23 00 10 43 00 00 00 00 00 00 00 00 00 00 00 00 24 00 00 01 25 01 23 00 22 54 25 01
23 00 25 55 00 00 00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01 23 00 25 55 25 01 23 00
28 12 00 00 00 00 00 00 00 00 00 00 00 00 70 00 00 01 25 01 23 00 37 23 25 01 23 00 40 24
00 00 00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01 23 00 40 24 25 01 23 00 42 42 00 00
00 00 00 00 00 00 00 00 00 00 70 00 00 01 25 01 23 00 51 32 25 01 23 00 54 33 00 00 00 00
00 00 00 00 00 00 00 00 70 00 00 01 25 01 23 00 54 33 25 01 23 00 56 51 00 00 00 00 00 00
00 00 00 00 00 00 94 00 00 01 25 01 23 01 06 20 25 01 23 01 09 21 00 00 00 00 00 00 00 00
00 00 00 00 88 00 00 01 25 01 23 01 09 21 25 01 23 01 11 38 00 00 00 00 00 00 00 00 00 00
00 00 74 00 00 01 25 01 23 01 20 28 25 01 23 01 23 29 00 00 00 00 00 00 00 00 00 00 00 00
64 00 00 01 25 01 23 01 23 29 25 01 23 01 25 47 00 00 00 00 00 00 00 00 00 00 00 00 6c 00
00 01 25 01 23 01 35 37 25 01 23 01 38 37 00 00 00 00 00 00 00 00 00 00 00 00 64 00 00 01
25 01 23 01 38 37 25 01 23 01 40 56 00 00 00 00 00 00 00 00 00 00 00 00 70 00 00 01 25 01
23 01 50 24 25 01 23 01 53 25 00 00 00 00 00 00 00 00 00 00 00 00 64 00 00 01 25 01 23 01
53 24 25 01 23 01 55 42 00 00 00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01 23 02 04 34
25 01 23 02 07 35 00 00 00 00 00 00 00 00 00 00 00 00 64 00 00 01 25 01 23 02 07 35 25 01
23 02 09 53 00 00 00 00 00 00 00 00 00 00 00 00 6c 00 00 01 25 01 23 02 19 01 25 01 23 02
22 02 00 00 00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01 23 02 22 02 25 01 23 02 24 20
00 00 00 00 00 00 00 00 00 00 00 00 6c 00 00 01 25 01 23 02 33 52 25 01 23 02 36 52 00 00
00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01 23 02 36 52 25 01 23 02 39 11 00 00 00 00
00 00 00 00 00 00 00 00 70 00 00 01 25 01 23 02 48 02 25 01 23 02 51 03 00 00 00 00 00 00
00 00 00 00 00 00 64 00 00 01 25 01 23 02 51 03 25 01 23 02 53 21 00 00 00 00 00 00 00 00
00 00 00 00 6c 00 00 01 25 01 23 03 01 59 25 01 23 03 04 59 00 00 00 00 00 00 00 00 00 00
00 00 64 00 00 01 25 01 23 03 04 59 25 01 23 03 07 18 00 00 00 00 00 00 00 00 00 00 00 00
70 00 00 01 25 01 23 03 16 04 25 01 23 03 19 04 00 00 00 00 00 00 00 00 00 00 00 00 68 00
00 01 25 01 23 03 19 04 25 01 23 03 21 23 00 00 00 00 00 00 00 00 00 00 00 00 70 00 00 01
25 01 23 03 30 55 25 01 23 03 33 56 00 00 00 00 00 00 00 00 00 00 00 00 68 00 00 01 25 01
## 23 03 33 56 25 01 23 03 36 14 00 00 00 00 00 00 00 00 00 00 00 00 70 0c 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 20 00 20 12 05 00 24 7e

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   62

- 0x9201 Platform-Initiated Remote Video Playback Request
Downlink (0x9201): 7e 92 01 00 26 4e b6 fb 4a d6 28 f8 14 0f 31 32 34 2e 32 34 33 2e 31
38 34 2e 32 33 37 27 13 00 00 01 00 00 00 00 00 25 01 23 10 15 12 25 01 23 10 18 12 fe 7e
Uplink (0x1205): 7e 12 05 00 22 4e b6 fb 4a d6 28 00 13 f8 14 00 00 00 01 01 25 01 23 10
15 12 25 01 23 10 18 12 00 00 00 00 00 00 00 00 00 00 00 00 d8 00 00 a8 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 13 00 13 12 05 00 24 7e

## 10. 0x9206 File Upload Command
Downlink (0x9206): 7e 92 06 00 5c 4e b6 fb 4a d6 28 f8 3d 17 68 6b 66 74 70 2e 74 72 61
63 6b 73 6f 6c 69 64 70 72 6f 2e 63 6f 6d 00 15 07 6a 69 6d 69 66 74 70 0f 45 79 61 63 52
4d 69 73 4b 47 51 4e 51 55 65 10 2f 74 73 70 2f 63 34 35 30 2f 31 31 37 34 38 2f 01 25 01
23 07 21 50 25 01 23 07 24 09 00 00 00 00 00 00 00 00 00 00 00 01 b1 7e
Uplink (0x0001): 7e 00 01 00 05 4e b6 fb 4a d6 28 00 1b f8 3d 92 06 00 f9 7e
Uplink (0x1206): 7e 12 06 00 03 4e b6 fb 4a d6 28 00 1c f8 3d 00 79 7e

## 11. 0x8801 Remote Image Capture Comand
Downlink (0x8801): 7e 88 01 00 0c 4e b6 fb 4a d6 28 f8 6b 01 00 01 00 00 00 02 05 80 40
40 80 a6 7e
Uplink (0x0805): 7e 08 05 00 09 4e b6 fb 4a d6 28 00 21 f8 6b 00 00 01 07 91 be 9e b6 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 21 00 21 08 05 00 3e 7e

## 12. 0x0800 Multimedia Event Information Upload
Uplink (0x0800): 7e 08 00 00 08 4e b6 fb 4a d6 28 00 22 07 91 be 9e 00 00 00 01 22 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 22 00 22 08 00 00 3b 7e



JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   63

## 13. 0x0801 Multimedia Data Upload
Uplink (0x0801): 7e 08 01 23 84 4e b6 fb 4a d6 28 00 23 00 6d 00 01 07 91 be 9e 00 00 00
01 00 00 00 00 00 0c 00 01 01 58 7d 01 ce 06 ca a2 10 00 00 00 00 00 00 25 01 23 11 59 26
ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff e1 00 e0 45 78 69 66 00 c3 4d
4d 00 2a 00 00 00 08 00 01 87 69 00 04 00 00 00 01 00 00 00 1a 00 00 00 00 00 0b 90 03 00
02 00 00 00 14 00 00 00 a4 a4 34 00 02 00 00 00 01 00 00 00 00 a4 35 00 02 00 00 00 01 00
00 00 00 92 02 00 05 00 00 00 01 00 00 00 b8 92 03 00 0a 00 00 00 01 00 00 00 c0 88 27 00
03 00 00 00 01 00 fc 00 00 82 9a 00 05 00 00 00 01 00 00 00 c8 92 04 00 0a 00 00 00 01 00
00 00 d0 88 22 00 03 00 00 00 01 00 02 00 00 a4 02 00 03 00 00 00 01 00 00 00 00 92 09 00
03 00 00 00 01 00 00 00 00 00 00 00 00 32 30 32 35 2d 30 31 2d 32 33 20 31 31 3a 35 39 3a
32 35 00 00 00 01 18 00 00 00 01 00 00 00 80 00 00 00 01 00 00 9c 3f 00 0f 42 40 00 00 00
00 00 00 00 01 ff db 00 43 00 08 0b 0c 0e 0c 0a 10 0e 0d 0e 12 11 10 13 18 29 1b 18 16 16
18 32 24 26 1e 29 3b 34 3e 3d 3a 34 39 38 41 49 5e 50 41 45 59 46 38 39 52 6f 53 59 61 64
69 6a 69 3f 4f 73 7b 72 66 7a 5e 67 69 65 ff db 00 43 01 08 12 12 18 15 18 30 1b 1b 30 65
43 39 43 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65
65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 65 ff c0 00 11 08 04 38
07 80 03 01 22 00 02 11 01 03 11 01 ff c4 00 1f 00 00 01 05 01 01 01 01 01 01 00 00 00 00
00 00 00 00 01 02 03 04 05 06 07 08 09 0a 0b ff c4 00 b5 10 00 02 01 03 03 02 04 03 05 05
04 04 00 00 01 7d 01 01 02 03 00 04 11 05 12 21 31 41 06 13 51 61 07 22 71 14 32 81 91 a1
08 23 42 b1 c1 15 52 d1 f0 24 33 62 72 82 09 0a 16 17 18 19 1a 25 26 27 28 29 2a 34 35 36
37 38 39 3a 43 44 45 46 47 48 49 4a 53 54 55 56 57 58 59 5a 63 64 65 66 67 68 69 6a 73 74
75 76 77 78 79 7a 83 84 85 86 87 88 89 8a 92 93 94 95 96 97 98 99 9a a2 a3 a4 a5 a6 a7 a8
a9 aa b2 b3 b4 b5 b6 b7 b8 b9 ba c2 c3 c4 c5 c6 c7 c8 c9 ca d2 d3 d4 d5 d6 d7 d8 d9 da e1
e2 e3 e4 e5 e6 e7 e8 e9 ea f1 f2 f3 f4 f5 f6 f7 f8 f9 fa ff c4 00 1f 01 00 03 01 01 01 01 01 01
01 01 01 00 00 00 00 00 00 01 02 03 04 05 06 07 08 09 0a 0b ff c4 00 b5 11 00 02 01 02 04
04 03 04 07 05 04 04 00 01 02 77 00 01 02 03 11 04 05 21 31 06 12 41 51 07 61 71 13 22 32
81 08 14 42 91 a1 b1 c1 09 23 33 52 f0 15 62 72 d1 0a 16 24 34 e1 25 f1 17 18 19 1a 26 27
28 29 2a 35 36 37 38 39 3a 43 44 45 46 47 48 49 4a 53 54 55 56 57 58 59 5a 63 64 65 66 67
68 69 6a 73 74 75 76 77 78 79 7a 82 83 84 85 86 87 88 89 8a 92 93 94 95 96 97 98 99 9a a2
a3 a4 a5 a6 a7 a8 a9 aa b2 b3 b4 b5 b6 b7 b8 b9 ba c2 c3 c4 c5 c6 c7 c8 c9 ca d2 d3 d4 d5
d6 d7 d8 d9 da e2 e3 e4 e5 e6 e7 e8 e9 ea f2 f3 f4 f5 f6 f7 f8 f9 fa ff da 00 0c 03 01 00 02 11
03 11 00 3f 00 f3 9a 28 a5 a0 41 4b 49 4b 40 c2 96 92 96 80 97 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 23 00 23 08 01 00 3a 7e
Downlink (0x8800): 7e 88 00 00 05 4e b6 fb 4a d6 28 00 01 07 a4 82 1a 00 00 7e

## 14. 0x8801 Remote Video Capture Command
Downlink (0x8801): 7e 88 01 00 0c 4e b6 fb 4a d6 28 fc 5f 01 ff ff 00 03 00 02 05 80 40 40
## 80 94 7e
Uplink (0x0805): 7e 08 05 00 09 4e b6 fb 4a d6 28 00 20 fc 5f 00 00 01 07 91 d7 2d 5d 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 20 00 20 08 05 00 3e 7e

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   64

- 0x0200 Vibrating Alert Reporting (Alert ID: 0x0406)
Uplink (0x0200): 7e 02 00 00 4f 4e b6 fb 4a d6 28 00 08 00 00 00 00 00 4c 00 02 01 58 7d
01 e0 06 ca a2 4c 00 40 00 01 00 22 25 01 22 16 37 45 01 04 00 00 00 00 25 04 00 00 00 00
30 01 18 31 01 1c eb 09 55 54 43 2b 30 38 3a 30 30 e8 14 04 06 10 00 00 00 00 00 00 00 25
## 01 22 16 37 45 00 07 00 00 48 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 0b 00 0b 02 00 00 31 7e
Downlink (0x8900) – Alarm attachment upload request: 7e 89 00 00 58 4e b6 fb 4a d6 28 df
70 f0 56 49 44 45 4f 55 50 4c 4f 41 44 2c 68 6b 68 74 74 70 75 70 6c 6f 61 64 2e 74 72 61
63 6b 73 6f 6c 69 64 70 72 6f 2e 63 6f 6d 2c 34 34 33 2c 30 30 30 30 30 30 30 30 30 30 30
30 30 30 32 35 30 31 32 32 31 36 33 37 34 35 30 30 30 37 30 30 2c 31 2d 32 2d 33 2c 32 73
## 7e
Uplink (0x0001) – Terminal response: 7e 00 01 00 05 4e b6 fb 4a d6 28 00 09 df 70 89 00
## 00 9c 7e
Uplink (0x0900) – Upload start: 7e 09 00 00 13 4e b6 fb 4a d6 28 df 70 f0 73 74 61 72 74 20
75 70 6c 6f 61 64 20 74 61 73 6b 3b a7 7e
Uplink (0x0900) – CH1 image upload complete: 7e 09 00 00 4d 4e b6 fb 4a d6 28 df 70 f0
55 50 4c 4f 41 44 46 49 4c 45 43 4f 4d 50 4c 45 54 45 3a 38 36 35 34 37 38 30 37 30 30 30
31 30 34 37 5f 30 30 30 30 30 30 30 30 30 30 30 30 30 30 32 35 30 31 32 32 31 36 33 37 34
## 35 30 30 30 37 30 30 5f 31 5f 30 30 2e 6a 70 67 91 7e
Uplink (0x0900) – CH1 video upload complete: 7e 09 00 00 4d 4e b6 fb 4a d6 28 df 70 f0 55
50 4c 4f 41 44 46 49 4c 45 43 4f 4d 50 4c 45 54 45 3a 38 36 35 34 37 38 30 37 30 30 30 31
30 34 37 5f 30 30 30 30 30 30 30 30 30 30 30 30 30 30 32 35 30 31 32 32 31 36 33 37 34 35
30 30 30 37 30 30 5f 31 5f 30 30 2e 6d 70 34 c5 7e
Uplink (0x0900) – CH2 image upload complete: 7e 09 00 00 4d 4e b6 fb 4a d6 28 df 70 f0
55 50 4c 4f 41 44 46 49 4c 45 43 4f 4d 50 4c 45 54 45 3a 38 36 35 34 37 38 30 37 30 30 30
31 30 34 37 5f 30 30 30 30 30 30 30 30 30 30 30 30 30 30 32 35 30 31 32 32 31 36 33 37 34
## 35 30 30 30 37 30 30 5f 32 5f 30 30 2e 6a 70 67 92 7e
Uplink (0x0900) – CH2 video upload complete: 7e 09 00 00 4d 4e b6 fb 4a d6 28 df 70 f0 55
50 4c 4f 41 44 46 49 4c 45 43 4f 4d 50 4c 45 54 45 3a 38 36 35 34 37 38 30 37 30 30 30 31
30 34 37 5f 30 30 30 30 30 30 30 30 30 30 30 30 30 30 32 35 30 31 32 32 31 36 33 37 34 35
30 30 30 37 30 30 5f 32 5f 30 30 2e 6d 70 34 c6 7e
Uplink (0x0900) – CH3 image upload complete: 7e 09 00 00 4d 4e b6 fb 4a d6 28 df 70 f0
55 50 4c 4f 41 44 46 49 4c 45 43 4f 4d 50 4c 45 54 45 3a 38 36 35 34 37 38 30 37 30 30 30
31 30 34 37 5f 30 30 30 30 30 30 30 30 30 30 30 30 30 30 32 35 30 31 32 32 31 36 33 37 34
## 35 30 30 30 37 30 30 5f 33 5f 30 30 2e 6a 70 67 93 7e
Uplink (0x0900) – CH3 video upload complete: 7e 09 00 00 4d 4e b6 fb 4a d6 28 df 70 f0 55
50 4c 4f 41 44 46 49 4c 45 43 4f 4d 50 4c 45 54 45 3a 38 36 35 34 37 38 30 37 30 30 30 31
30 34 37 5f 30 30 30 30 30 30 30 30 30 30 30 30 30 30 32 35 30 31 32 32 31 36 33 37 34 35
30 30 30 37 30 30 5f 33 5f 30 30 2e 6d 70 34 c7 7e

JC371 Communication Protocol and Data Format
Confidentiality: Confidential ☐Restricted ☐Public

Copyright © Shenzhen Jimi IoT Co., Ltd. All Rights Reserved.   65

- 0x0200 SOS Alert Reporting (Alert ID: 0x0C01)
Uplink (0x0200): 7e 02 00 00 4f 4e b6 fb 4a d6 28 00 10 00 00 00 00 00 4c 00 03 01 58 7d
01 fb 06 ca a2 18 00 38 00 01 00 00 25 01 22 16 54 19 01 04 00 00 00 00 25 04 00 00 00 00
30 01 18 31 01 1e eb 09 55 54 43 2b 30 38 3a 30 30 e8 14 0c 01 10 00 00 00 00 00 00 00 25
## 01 22 16 54 19 01 07 00 00 48 7e
Downlink (0x8001): 7e 80 01 00 05 4e b6 fb 4a d6 28 00 10 00 10 02 00 00 31 7e
Downlink (0x8900) – Alarm attachment upload request: 7e 89 00 00 58 4e b6 fb 4a d6 28 e0
26 f0 56 49 44 45 4f 55 50 4c 4f 41 44 2c 68 6b 68 74 74 70 75 70 6c 6f 61 64 2e 74 72 61
63 6b 73 6f 6c 69 64 70 72 6f 2e 63 6f 6d 2c 34 34 33 2c 30 30 30 30 30 30 30 30 30 30 30
30 30 30 32 35 30 31 32 32 31 36 35 34 31 39 30 31 30 37 30 30 2c 31 2d 32 2d 33 2c 32 17
## 7e
Uplink (0x0001) – Terminal response: 7e 00 01 00 05 4e b6 fb 4a d6 28 00 11 e0 26 89 00
00 ed 7e
Uplink (0x0900) – Upload start: 7e 09 00 00 13 4e b6 fb 4a d6 28 e0 26 f0 73 74 61 72 74 20
75 70 6c 6f 61 64 20 74 61 73 6b 3b ce 7e
NOTE: The attachment upload completion notification shares a common data structure
with the vibrating alert. Due to space limitations, data examples for other event alerts
(including DMS alerts, ADAS alerts, facial recognition alerts, overspeed alerts, UBI-
related alerts, etc.) are not shown here.

