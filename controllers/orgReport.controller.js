const nodemailer = require("nodemailer");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const BookingDetails = require("../modules/bookingdetails.module.js");
const Event = require("../modules/event.module.js");
const User = require("../modules/user.module.js");
const axios = require("axios");
const PDFDocument = require("pdfkit-table");


const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 400, height: 200 });

async function generateReport(eventId) {
    const event = await Event.findById(eventId);
    if (!event) throw new Error("Event not found");

    const bookings = await BookingDetails.find({ eventId });

    const totalBookings = bookings.length;
    const cancelledBookings = bookings.filter((b) => b.book_status === "Cancelled").length;
    const successfulBookings = totalBookings - cancelledBookings;
    const totalCapacity = event.totalEventCapacity;
    const availableCapacity = event.eventCapacity;
    let profit = bookings.reduce(
        (acc, b) => acc + (b.book_status === "Booked" ? b.totalAmount : 0),
        0
    );

    profit = profit - (profit*0.025);
    const cancellationProfit = event.totalAmount - profit;
    const totalProfit = event.totalAmount;
    const cancellationRate = totalBookings > 0 ? ((cancelledBookings / totalBookings) * 100).toFixed(2) : 0;

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => { });

    // Download logo
    const logoUrl = "https://i.imgur.com/sx36L2V.png";
    let logoBuffer;
    try {
        const response = await axios.get(logoUrl, { responseType: "arraybuffer" });
        logoBuffer = Buffer.from(response.data, "binary");
    } catch (error) {
        console.error("Error downloading logo:", error);
        logoBuffer = null;
    }

    // Header with logo and title
    doc.rect(0, 0, doc.page.width, 110).fill("#030711");

    if (logoBuffer) {
        doc.image(logoBuffer, 200, 14, { width: 60 });
    }

    doc.font("Helvetica-Bold").fill('#2269C5').fontSize(24).text("EventHorizon", 120, 35, { align: "center" });

    doc.fill("#ffffff").fontSize(20).text("Event Report", 100, 80, { align: "center" });

    doc.moveDown(1);

    // Centered Event Summary
    doc.fill("#000000").fontSize(16).text("Event Summary", { align: "center", underline: true });
    doc.moveDown(1);


    if (event.imageUrl) {
        try {
            const imgResponse = await axios.get(event.imageUrl, { responseType: "arraybuffer" });
            const eventImageBuffer = Buffer.from(imgResponse.data, "binary");
            doc.image(eventImageBuffer, 450, 155, { width: 100, height: 75, align: "center" });
        } catch (error) {
            console.error("Error downloading event image:", error);
        }
    }

    doc.font("Helvetica-Bold").fontSize(12).text(`Title:`, { align: "left", continued: true }).font("Helvetica").text(` ${event.eventTitle}`);
    doc.font("Helvetica-Bold").text(`Date:`, { align: "left", continued: true }).font("Helvetica").text(` ${event.eventDate.toDateString()}`);
    doc.font("Helvetica-Bold").text(`Price:`, { align: "left", continued: true }).font("Helvetica").text(` Rs. ${event.eventPrice}`);
    doc.font("Helvetica-Bold").text(`Language:`, { align: "left", continued: true }).font("Helvetica").text(` ${event.eventLanguage}`);


    doc.moveDown(2);

    const detailsTable = {
        headers: [
            "Available Capacity",
            "Total Capacity",
            "Total Bookings",
            "Succ. Bookings",
            "Cancelled Bookings",
            "Cancel. Rate",
            "Cancel. Profit",
            "Booking Profit",
            "Total Profit"
        ],
        rows: [
            [availableCapacity, totalCapacity, totalBookings, successfulBookings, cancelledBookings, `${cancellationRate}%`, `Rs. ${cancellationProfit.toFixed(4)}`, `Rs. ${profit.toFixed(4)}`, `Rs. ${totalProfit.toFixed(4)}`]
        ],
    };

    await doc.table(detailsTable, {
        columnsSize: [61, 61, 61, 61, 61, 61, 61, 61, 61],
        cellPadding: 5,
        x: 40,
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
        prepareRow: () => doc.font("Helvetica").fontSize(10),
    });

    doc.moveDown(2);

    // Pie Chart (Bookings vs Capacity) - Below Summary
    doc.fontSize(14).text("Bookings vs Capacity", { align: "center", underline: true });
    const pieChartBuffer = await chartJSNodeCanvas.renderToBuffer({
        type: "pie",
        data: {
            labels: ["Bookings", "Available"],
            datasets: [{ data: [totalBookings, totalCapacity - totalBookings], backgroundColor: ["#95EB39", "#4F8DE0"] }],
        },
    });
    doc.image(pieChartBuffer, doc.page.width / 2 - 100, doc.y, { width: 200, height: 170 });
    doc.moveDown(2);

    doc.moveDown(10);

    // Bar Chart (Bookings, Profit, Cancellations) - Below Pie Chart
    doc.fontSize(14).text("Bookings, Profit & Cancellations", { align: "center", underline: true });

    const barChartBuffer = await chartJSNodeCanvas.renderToBuffer({
        type: "bar",
        data: {
            labels: ["", "", ""], // Keeps bars centered
            datasets: [
                {
                    label: "Successful Bookings",
                    data: [successfulBookings, null, null], 
                    backgroundColor: "#48bb78",
                    borderColor: "#2f855a",
                    borderWidth: 2,
                    yAxisID: "y",
                    barPercentage: 0.6,
                    categoryPercentage: 0.6,
                },
                {
                    label: "Cancellations",
                    data: [null, cancelledBookings, null], 
                    backgroundColor: "#f56565",
                    borderColor: "#c53030",
                    borderWidth: 2,
                    yAxisID: "y",
                    barPercentage: 0.6,
                    categoryPercentage: 0.6,
                },
                {
                    label: "Profit",
                    data: [null, null, totalProfit], 
                    backgroundColor: "#4299e1",
                    borderColor: "#2b6cb0",
                    borderWidth: 2,
                    yAxisID: "y1",
                    barPercentage: 0.6,
                    categoryPercentage: 0.6,
                }
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "x",
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    align: "center",
                    labels: {
                        usePointStyle: true,
                        boxWidth: 16, // Keeps labels in one clean line
                        padding: 20, // Adds spacing between the legend & chart
                        font: { size: 14 },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Bookings / Cancellations" },
                    ticks: { stepSize: 1 },
                },
                y1: {
                    beginAtZero: true,
                    position: "right",
                    title: { display: true, text: "Profit (Rs.)" },
                    grid: { drawOnChartArea: false },
                },
                x: {
                    title: { display: false },
                    ticks: { display: false },
                },
            },
        },
    });
    
    
    

    doc.image(barChartBuffer, doc.page.width / 2 - 200, doc.y, { width: 400, height: 200 });
    doc.moveDown(5);

    // Move "Booking Details" to the next page
    doc.addPage();
    doc.text("Booking Details", { align: "center", fontSize: 16, underline: true });
    doc.moveDown();

    const bookingsTable = {
        headers: ["Sr. No.", "Customer Name", "Type", "Amount (Rs.)", "Status", "Cancel. Charges"],
        rows: bookings.map((b, i) => {
            const types = [
                { label: "Standard", count: b.noOfPeoples[0] },
                { label: "Premium", count: b.noOfPeoples[1] },
                { label: "Child", count: b.noOfPeoples[2] }
            ].filter(t => t.count > 0); // Remove types with count 0
    
            const cancellationCharges = b.book_status === "Cancelled" ? `Rs. ${(b.totalAmount * 0.025).toFixed(4)}` : "-";

            return [
                i + 1,  // Sr. No.
                b.customer_name, // Customer Name
                types.map(t => `${t.label} (${t.count})`).join("\n"), // Combine types in one cell (newline separated)
                b.totalAmount, // Amount
                b.book_status, // Status
                cancellationCharges // Cancellation Charges
            ];
        }),
    };
    
    
    await doc.table(bookingsTable, {
        columnsSize: [50, 160, 70, 50, 70, 50],
        cellPadding: 5,
        x: 100,
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
        prepareRow: () => doc.font("Helvetica").fontSize(10),
    });

    // Add space for footer
    doc.moveDown(3);
    doc.fontSize(10).text("This report is auto-generated by EventHorizon.", { align: "center" });

    doc.end();

    return new Promise((resolve) => {
        doc.on("end", () => {
            resolve(Buffer.concat(buffers));
        });
    });
}

async function sendReport(req, res) {
    try {
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        if (event.isTemp) {
            return res.status(403).json({ error: "This Event is Pending and not Live for users." });
        }

        // Generate Report
        let pdfBuffer;
        try {
            pdfBuffer = await generateReport(eventId);
            if (!pdfBuffer) {
                return res.status(500).json({ error: "Failed to generate report." });
            }
        } catch (err) {
            console.error("Error generating report:", err);
            return res.status(500).json({ error: "Error occurred while generating the report." });
        }

        // Fetch Organizer
        const user = await User.findById(event.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const eventDate = new Date(event.eventDate).toDateString();

        // Count Total Tickets Sold
        const totalTicketsSold = await BookingDetails.countDocuments({
            eventId: event._id,
            book_status: { $in: ["Booked", "Completed"] }
        });

        // Setup Mail Transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASSWORD },
        });

        // Prepare Email
        const mailOptions = {
            from: process.env.EMAIL,
            to: user.emailID,
            subject: `Event Report: ${event.eventTitle}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
                    
                    <!-- Header Section -->
                    <div style="text-align: center; background-color: #030711; padding: 15px; border-radius: 8px 8px 0 0;">
                        <img src="https://i.imgur.com/sx36L2V.png" alt="EventHorizon Logo" style="max-width: 80px;">
                        <h2 style="color: #ffffff; margin: 10px 0;">Event Report</h2>
                    </div>
        
                    <!-- Report Summary -->
                    <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px;">
                        <p style="font-size: 16px;">Dear <strong>${user.userName}</strong>,</p>
                        <p>Attached is the event report for:</p>
                        
                        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                            <!-- Event Image -->
                            ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.eventTitle}" style="max-width: 120px; border-radius: 5px; margin-bottom: 10px;">` : ''}
                            
                            <h3 style="color: #333;">${event.eventTitle}</h3>
                            <p><strong>${eventDate}</strong></p> 
                        </div>
        
                        <h3 style="color: #0078ff; margin-top: 20px;">Report Details</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Tickets Sold:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${totalTicketsSold}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Revenue:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">Rs. ${event.totalAmount}</td>
                            </tr>
                        </table>
        
                        <p style="font-size: 16px; color: #d9534f; text-align: center; margin-top: 20px;">
                            📎 Please check the attached PDF for the complete event report.
                        </p>
        
                        <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                            Thank you for organizing with us!<br>Best Regards, <br>EventHorizon Team
                        </p>
                    </div>
        
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
                    <!-- Footer -->
                    <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
                </div>
            `,
            attachments: [{
                filename: `${event.eventTitle}_Report.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf"
            }]
        };

        // Send Email with Try-Catch
        try {
            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: "Report sent successfully" });
        } catch (err) {
            console.error("Error sending email:", err);
            res.status(500).json({ error: "Failed to send report email", details: err.message });
        }

    } catch (error) {
        console.error("Error sending report:", error);
        res.status(500).json({ error: "Failed to send report", details: error.message });
    }
}


async function downloadReport(req, res) {
    try {
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        if (event.isTemp) {
            return res.status(403).json({ error: "This Event is Pending and not Live for users." });
        }

        let pdfBuffer;
        try {
            pdfBuffer = await generateReport(eventId);
            if (!pdfBuffer) {
                return res.status(500).json({ error: "Failed to generate report." });
            }
        } catch (err) {
            console.error("Error generating report:", err);
            return res.status(500).json({ error: "Error occurred while generating the report." });
        }

        res.setHeader("Content-Disposition", `attachment; filename="${event.eventTitle}_Report.pdf"`);
        res.setHeader("Content-Type", "application/pdf");
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error downloading report:", error);
        res.status(500).json({ error: "Failed to download report", details: error.message });
    }
}

module.exports = { generateReport, sendReport, downloadReport };
