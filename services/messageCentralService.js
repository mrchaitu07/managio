// Uses Node.js built-in fetch (available in Node 18+)

const BASE_URL = 'https://cpaas.messagecentral.com';

class MessageCentralService {
  /**
   * Get the auth token from environment.
   * The token provided from the dashboard is long-lived (expires ~2031).
   */
  static getAuthToken() {
    const token = process.env.MSG_CENTRAL_AUTH_TOKEN;
    if (!token) {
      throw new Error('MSG_CENTRAL_AUTH_TOKEN is not set in environment variables');
    }
    return token;
  }

  /**
   * Send OTP to a mobile number via Message Central SMS.
   * @param {string} mobileNumber - The mobile number (can include +91 prefix)
   * @param {number} otpLength - Length of OTP (4-8, default 6)
   * @returns {object} { success, verificationId, message }
   */
  static async sendOTP(mobileNumber, otpLength = 6) {
    try {
      const authToken = this.getAuthToken();
      const customerId = process.env.MSG_CENTRAL_CUSTOMER_ID;

      if (!customerId) {
        throw new Error('MSG_CENTRAL_CUSTOMER_ID is not set in environment variables');
      }

      // Strip +91 or 91 prefix to get the raw 10-digit number
      let rawNumber = mobileNumber.replace(/^\+?91/, '');
      // If it's still longer than 10 digits, take the last 10
      if (rawNumber.length > 10) {
        rawNumber = rawNumber.slice(-10);
      }

      const url = `${BASE_URL}/verification/v3/send?countryCode=91&customerId=${customerId}&flowType=SMS&mobileNumber=${rawNumber}&otpLength=${otpLength}`;

      console.log(`[MessageCentral] Sending OTP to ${rawNumber}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authToken': authToken,
          'accept': '*/*',
        },
      });

      const data = await response.json();
      console.log('[MessageCentral] Send OTP response:', JSON.stringify(data));

      if (data.responseCode === 200 && data.data) {
        return {
          success: true,
          verificationId: data.data.verificationId,
          mobileNumber: data.data.mobileNumber,
          timeout: data.data.timeout || '60',
          transactionId: data.data.transactionId,
          message: 'OTP sent successfully',
        };
      } else {
        const errorMsg = data.data?.errorMessage || data.message || 'Failed to send OTP';
        console.error('[MessageCentral] Send OTP error:', errorMsg);
        return {
          success: false,
          message: errorMsg,
          responseCode: data.responseCode,
        };
      }
    } catch (error) {
      console.error('[MessageCentral] Send OTP exception:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to send OTP via Message Central',
      };
    }
  }

  /**
   * Validate OTP entered by the user.
   * @param {string} verificationId - The verificationId from sendOTP response
   * @param {string} code - The OTP code entered by the user
   * @returns {object} { success, message, verificationStatus }
   */
  static async validateOTP(verificationId, code) {
    try {
      const authToken = this.getAuthToken();
      const customerId = process.env.MSG_CENTRAL_CUSTOMER_ID;

      const url = `${BASE_URL}/verification/v3/validateOtp?customerId=${customerId}&verificationId=${verificationId}&code=${code}`;

      console.log(`[MessageCentral] Validating OTP for verificationId: ${verificationId}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'authToken': authToken,
          'accept': '*/*',
        },
      });

      const data = await response.json();
      console.log('[MessageCentral] Validate OTP response:', JSON.stringify(data));

      if (data.responseCode === 200 && data.data?.verificationStatus === 'VERIFICATION_COMPLETED') {
        return {
          success: true,
          message: 'OTP verified successfully',
          verificationStatus: data.data.verificationStatus,
          transactionId: data.data.transactionId,
        };
      } else {
        let errorMsg = 'Invalid or expired OTP';
        if (data.responseCode === 702) {
          errorMsg = 'Wrong OTP provided. Please try again.';
        } else if (data.responseCode === 703) {
          errorMsg = 'OTP already verified.';
        } else if (data.responseCode === 705) {
          errorMsg = 'OTP has expired. Please request a new one.';
        } else if (data.responseCode === 700) {
          errorMsg = 'Verification failed. Please try again.';
        } else if (data.data?.errorMessage) {
          errorMsg = data.data.errorMessage;
        }

        console.error('[MessageCentral] Validate OTP error:', errorMsg, 'Code:', data.responseCode);
        return {
          success: false,
          message: errorMsg,
          responseCode: data.responseCode,
          verificationStatus: data.data?.verificationStatus,
        };
      }
    } catch (error) {
      console.error('[MessageCentral] Validate OTP exception:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to validate OTP',
      };
    }
  }
}

module.exports = MessageCentralService;
