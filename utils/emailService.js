const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.initialized = false;
    }

    ensureInitialized() {
        if (!this.initialized) {
            this.initializeTransporter();
            this.initialized = true;
        }
    }

    initializeTransporter() {
        try {
            // Check if email configuration is available
            if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
                console.log('[Email] SMTP configuration not found, email service disabled');
                return;
            }

            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false // Allow self-signed certificates in development
                }
            });

            this.isConfigured = true;
            console.log('[Email] Email service initialized successfully');
        } catch (error) {
            console.error('[Email] Failed to initialize email service:', error);
            this.isConfigured = false;
        }
    }

    async verifyConnection() {
        this.ensureInitialized();

        if (!this.isConfigured) {
            return false;
        }

        try {
            await this.transporter.verify();
            console.log('[Email] SMTP connection verified');
            return true;
        } catch (error) {
            console.error('[Email] SMTP connection failed:', error);
            return false;
        }
    }

    generateEmailTemplate(type, data) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        switch (type) {
            case 'mod_approved':
                return {
                    subject: `🎉 Your mod "${data.modTitle}" has been approved!`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px;">🎉 Mod Approved!</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Great news, ${data.username}!</h2>
                                <p style="font-size: 16px; line-height: 1.6; color: #555;">
                                    Your mod <strong>"${data.modTitle}"</strong> has been approved and is now live on Sayonika!
                                </p>
                                ${data.reason ? `
                                    <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                                        <strong>Admin Note:</strong> ${data.reason}
                                    </div>
                                ` : ''}
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${baseUrl}/mod/${data.modId}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                        View Your Mod
                                    </a>
                                </div>
                                <p style="color: #666; font-size: 14px;">
                                    Thank you for contributing to the Sayonika community! Your mod is now available for everyone to enjoy.
                                </p>
                            </div>
                        </div>
                    `
                };

            case 'mod_rejected':
                return {
                    subject: `Your mod "${data.modTitle}" needs attention`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px;">📝 Mod Review Update</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Hello ${data.username},</h2>
                                <p style="font-size: 16px; line-height: 1.6; color: #555;">
                                    Your mod <strong>"${data.modTitle}"</strong> has been reviewed and needs some adjustments before it can be published.
                                </p>
                                ${data.reason ? `
                                    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                                        <strong>Feedback:</strong> ${data.reason}
                                    </div>
                                ` : ''}
                                <p style="color: #555; line-height: 1.6;">
                                    Don't worry! You can create a new mod submission with the necessary changes. Please review our
                                    <a href="${baseUrl}/guidelines" style="color: #007bff;">community guidelines</a> to ensure your next submission meets our standards.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${baseUrl}/upload" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                        Upload New Mod
                                    </a>
                                </div>
                            </div>
                        </div>
                    `
                };

            case 'achievement_unlocked':
                return {
                    subject: `🏆 Achievement Unlocked: ${data.achievementName}!`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%); color: #333; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px;">🏆 Achievement Unlocked!</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Congratulations, ${data.username}!</h2>
                                <div style="text-align: center; margin: 20px 0;">
                                    <div style="background: white; border: 3px solid #ffd700; border-radius: 10px; padding: 20px; display: inline-block;">
                                        <h3 style="margin: 0; color: #333; font-size: 24px;">${data.achievementName}</h3>
                                        <p style="margin: 10px 0 0 0; color: #666; font-style: italic;">${data.achievementDescription}</p>
                                        <div style="margin-top: 15px;">
                                            <span style="background: #ffd700; color: #333; padding: 5px 15px; border-radius: 20px; font-weight: bold;">
                                                +${data.points} points
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <p style="color: #555; line-height: 1.6; text-align: center;">
                                    You've earned this achievement and gained ${data.points} achievement points! Keep up the great work in the Sayonika community.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${baseUrl}/achievements" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                        View All Achievements
                                    </a>
                                </div>
                            </div>
                        </div>
                    `
                };

            case 'email_verification':
                return {
                    subject: 'Verify your Sayonika account',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px;">Welcome to Sayonika!</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Hello ${data.username},</h2>
                                <p style="font-size: 16px; line-height: 1.6; color: #555;">
                                    Thank you for joining Sayonika! To complete your account setup, please verify your email address by clicking the button below.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${baseUrl}/verify-email?token=${data.verificationToken}" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                                        Verify Email Address
                                    </a>
                                </div>
                                <p style="color: #666; font-size: 14px;">
                                    If you didn't create this account, you can safely ignore this email.
                                </p>
                                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                                    This verification link will expire in 24 hours.
                                </p>
                            </div>
                        </div>
                    `
                };

            case 'password_reset':
                const resetUrl = `${baseUrl}/reset-password?token=${data.resetToken}`;
                return {
                    subject: 'Reset your Sayonika password',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Hello ${data.username},</h2>
                                <p style="font-size: 16px; line-height: 1.6; color: #555;">
                                    We received a request to reset your password for your Sayonika account. If you made this request, click the button below to set a new password.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${resetUrl}" style="background: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                                        Reset My Password
                                    </a>
                                </div>
                                <p style="color: #666; font-size: 14px;">
                                    If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
                                </p>
                                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                                    This reset link will expire in 1 hour for security reasons.
                                </p>
                                <p style="color: #999; font-size: 12px; margin-top: 20px;">
                                    If the button doesn't work, copy and paste this link into your browser:<br>
                                    <a href="${resetUrl}" style="color: #007bff; word-break: break-all;">${resetUrl}</a>
                                </p>
                            </div>
                        </div>
                    `
                };

            case 'support_ticket':
                return {
                    subject: `New Support Ticket: ${data.subject}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px;">New Support Ticket</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Ticket Details</h2>
                                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                                    <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${data.subject}</p>
                                    <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${data.name} (${data.email})</p>
                                    <p style="margin: 0 0 10px 0;"><strong>Priority:</strong> <span style="text-transform: capitalize; color: ${data.priority === 'urgent' ? '#dc3545' : data.priority === 'high' ? '#fd7e14' : data.priority === 'medium' ? '#ffc107' : '#28a745'};">${data.priority}</span></p>
                                    ${data.username ? `<p style="margin: 0 0 10px 0;"><strong>User:</strong> ${data.username}</p>` : ''}
                                    <p style="margin: 0 0 10px 0;"><strong>Ticket ID:</strong> #${data.ticketId}</p>
                                </div>
                                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="color: #333; margin-top: 0;">Message:</h3>
                                    <p style="font-size: 16px; line-height: 1.6; color: #555; white-space: pre-wrap;">${data.message}</p>
                                </div>
                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="${baseUrl}/admin/tickets/${data.ticketId}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Ticket</a>
                                </div>
                                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px;">
                                    <p>This email was sent to all administrators and owners of Sayonika.</p>
                                </div>
                            </div>
                        </div>
                    `
                };

            default:
                return {
                    subject: 'Notification from Sayonika',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
                                <h2 style="color: #333;">Hello ${data.username || 'User'},</h2>
                                <p style="font-size: 16px; line-height: 1.6; color: #555;">
                                    ${data.message || 'You have a new notification from Sayonika.'}
                                </p>
                            </div>
                        </div>
                    `
                };
        }
    }

    async sendEmail(to, type, data) {
        this.ensureInitialized();

        if (!this.isConfigured) {
            console.log('[Email] Email service not configured, skipping email send');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const template = this.generateEmailTemplate(type, data);

            const mailOptions = {
                from: `"Sayonika" <${process.env.SMTP_USER}>`,
                to: to,
                subject: template.subject,
                html: template.html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`[Email] Email sent successfully to ${to}: ${template.subject}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error(`[Email] Failed to send email to ${to}:`, error);
            return { success: false, error: error.message };
        }
    }

    async sendModApprovalEmail(userEmail, username, modTitle, modId, reason = null) {
        return await this.sendEmail(userEmail, 'mod_approved', {
            username,
            modTitle,
            modId,
            reason
        });
    }

    async sendModRejectionEmail(userEmail, username, modTitle, reason = null) {
        return await this.sendEmail(userEmail, 'mod_rejected', {
            username,
            modTitle,
            reason
        });
    }

    async sendAchievementEmail(userEmail, username, achievementName, achievementDescription, points) {
        return await this.sendEmail(userEmail, 'achievement_unlocked', {
            username,
            achievementName,
            achievementDescription,
            points
        });
    }

    async sendVerificationEmail(userEmail, username, verificationToken) {
        return await this.sendEmail(userEmail, 'email_verification', {
            username,
            verificationToken
        });
    }

    async sendSupportTicketEmail(adminEmails, ticketData) {
        this.ensureInitialized();

        if (!this.isConfigured) {
            console.log('[Email] Email service not configured, skipping support ticket email');
            return { success: false, error: 'Email service not configured' };
        }

        if (!adminEmails || adminEmails.length === 0) {
            console.log('[Email] No admin emails found, skipping support ticket email');
            return { success: false, error: 'No admin emails found' };
        }

        try {
            const template = this.generateEmailTemplate('support_ticket', ticketData);

            // Send to all admins in one email with BCC
            const mailOptions = {
                from: `"Sayonika Support" <${process.env.SMTP_USER}>`,
                to: adminEmails[0], // First admin as primary recipient
                bcc: adminEmails.slice(1), // Rest as BCC
                subject: template.subject,
                html: template.html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`[Email] Support ticket email sent to ${adminEmails.length} admins: ${template.subject}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error(`[Email] Failed to send support ticket email:`, error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
