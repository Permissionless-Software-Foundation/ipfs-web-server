# Create a Dockerized API server
#

#IMAGE BUILD COMMANDS
# ct-base-ubuntu = ubuntu 18.04 + nodejs v10 LTS
# https://github.com/christroutner/docker-base/blob/master/Dockerfile
FROM christroutner/ct-base-ubuntu
MAINTAINER Chris Troutner <chris.troutner@gmail.com>

#Set the working directory to be the home directory
WORKDIR /home/safeuser

# Expose the port the API will be served on.
EXPOSE 3210

# Switch to user account.
USER safeuser
# Prep 'sudo' commands.
RUN echo 'abcd8765' | sudo -S pwd

# Install IPFS
#VOLUME /home/safeuser/.ipfs
WORKDIR /home/safeuser

# Clone the project.
WORKDIR /home/safeuser
RUN git clone https://github.com/Permissionless-Software-Foundation/ipfs-web-server
WORKDIR /home/safeuser/ipfs-web-server
#RUN git checkout unstable

# Install dependencies
RUN npm install

# Alter the IPFS to a the mounted volume.
RUN echo "export IPFS_PATH=/home/safeuser/ipfs-web-server/ipfs-data" >> /home/safeuser/.profile

# Declare the path to volumes for persisting data.
VOLUME /home/safeuser/ipfs-web-server/ipfs-data

# IPFS port
EXPOSE 4001

# Copy the config file, which determins the internal port and the BCH address
# to monitor.
COPY common.js config/env/common.js

# Debug
#WORKDIR /home/safeuser
#COPY dummyapp.js dummyapp.js
#CMD ["node", "dummyapp.js"]

# Start the application.
COPY start-production.sh start-production.sh
CMD ["./start-production.sh"]
