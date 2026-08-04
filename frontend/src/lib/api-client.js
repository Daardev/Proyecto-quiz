export class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    };
    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      if (contentType.includes('application/json')) {
        const data = await response.json();
        errorMsg = data.error || errorMsg;
      }
      throw new Error(errorMsg);
    }

    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  getMe() { return this.request('/auth/me'); }
  logout() { return this.request('/auth/logout', { method: 'POST' }); }
  register(data) { return this.request('/auth/register', { method: 'POST', body: data }); }
  login(data) { return this.request('/auth/login', { method: 'POST', body: data }); }

  getLanguages() { return this.request('/languages'); }
  generateQuiz(data) { return this.request('/quizzes/generate', { method: 'POST', body: data }); }
  getCurrentQuestion(quizId) { return this.request(`/quizzes/${quizId}/current`); }
  submitAnswer(quizId, data) { return this.request(`/quizzes/${quizId}/submit`, { method: 'POST', body: data }); }
  skipQuestion(quizId, data) { return this.request(`/quizzes/${quizId}/skip`, { method: 'POST', body: data }); }
  getResults(quizId) { return this.request(`/quizzes/${quizId}/results`); }
}

export const api = new ApiClient();
